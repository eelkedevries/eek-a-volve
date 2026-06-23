import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import type { Rng } from './rng.ts';
import type { SpatialGrid } from './grid.ts';
import {
  SIZE,
  SPEED,
  SENSE_RADIUS,
  DIET,
  DISPLAY,
  MATE_PREFERENCE,
  TRAIT_COUNT,
  SPECIES_TRAIT_COUNT,
  TRAIT_RANGES,
} from './genome.ts';
import { feed, energyCapacity } from './energy.ts';
import { consumeFood, PLANT, CARRION } from './food.ts';
import { evaluate, BRAIN_INPUTS, BRAIN_OUTPUTS, BRAIN_WEIGHT_COUNT } from './brain.ts';
import { breed, breedSexual } from './mutation.ts';
import type { PheromoneField } from './pheromone.ts';
import { PHEROMONE_GRADIENT_EPSILON } from './pheromone.ts';
import { IDLE, SEEKING, EATING, FLEEING, COURTING } from './state.ts';
import { isMature } from './lifestage.ts';
import { SPECIES_DISTANCE_THRESHOLD } from './speciation.ts';
import { INFECTED } from './disease.ts';
import { cultureForagingFactor, geneCultureFactor } from './culture.ts';

const TWO_PI = Math.PI * 2;

/** Distance within which an agent eats the food it has reached. */
export const EAT_RADIUS = 4;
/** Energy gained from eating one food item (provisional; tuned in 012). */
export const FOOD_ENERGY = 25;
/** Fraction of the parent's energy handed to an asexual offspring. */
export const REPRODUCTION_COST_FRACTION = 0.5;
/** Distance within which two ready, compatible adults mate. */
export const MATE_RADIUS = 24;
/** Fraction of each parent's energy invested in a sexual offspring. */
export const SEXUAL_COST_FRACTION = 0.3;
/** Distance multiplier applied to non-preferred food types when choosing what to eat. */
export const FOOD_TYPE_PENALTY = 4;
/** How strongly a mismatch between a candidate's display and the chooser's preference penalises it. */
export const MATE_PREFERENCE_WEIGHT = 8;
/** Radius within which conspecifics count toward a forager's social-brain group (079). */
export const SOCIAL_GROUP_RADIUS = 30;

/** Maximum `senseRadius` — the cognitive investment the social return scales with. */
const SENSE_MAX = TRAIT_RANGES[SENSE_RADIUS].max;

/**
 * The social-brain foraging multiplier (079): a creature eating amid a larger
 * local conspecific group, and investing more in `senseRadius`, gains a small,
 * bounded bonus to the energy it takes from food. Saturating in group size
 * (`1 - 1/groupSize` → 1) so it cannot run away, and zero for a solitary forager
 * (group size 1) — the return exists only in company. Bounded above by
 * `1 + gain`. A deterministic function of the local count and `senseRadius`; it
 * adds no RNG.
 */
export function socialForagingFactor(
  groupSize: number,
  senseRadius: number,
  gain: number,
): number {
  const senseFrac = senseRadius / SENSE_MAX;
  const crowd = groupSize > 1 ? 1 - 1 / groupSize : 0;
  return 1 + gain * senseFrac * crowd;
}

/**
 * The hand-coded, trait-parameterised behaviour policy (specification: Domain
 * rules → Behaviour, Reproduction). Each tick, every agent alive at the start of
 * the tick: flees the nearest larger, more carnivorous neighbour; otherwise, if
 * mature and well-fed, courts the nearest compatible adult; otherwise heads for
 * food and eats it; otherwise wanders. Reproduction is sexual (two adults meet,
 * genome crossover) or asexual, by configuration.
 *
 * A reused object with bound visitors and a snapshot buffer so the per-tick path
 * allocates nothing.
 */
export class Behaviour {
  private readonly live: Int32Array;
  private readonly mated: Uint8Array;
  private readonly selfNorm = new Float64Array(TRAIT_COUNT);
  // Reused neural-net I/O buffers (allocation-free; only used when brains are on).
  private readonly brainInputs = new Float32Array(BRAIN_INPUTS);
  private readonly brainOutputs = new Float32Array(BRAIN_OUTPUTS);

  /** Slots of offspring born with a freak mutation this tick (drained by the Simulation). */
  readonly freakBirths: Int32Array;
  freakBirthCount = 0;

  /** Slots of all offspring born this tick (drained by the Simulation for lineage). */
  readonly newborns: Int32Array;
  newbornCount = 0;

  private world!: World;
  private self = -1;
  private px = 0;
  private py = 0;
  private selfSize = 0;
  private selfDiet = 0;
  private threshold = 0;
  private selfReady = false;

  private bestFood = -1;
  private bestFoodWeighted = Infinity;

  private hasThreat = false;
  private threatX = 0;
  private threatY = 0;
  private threatDist2 = Infinity;

  private bestMate = -1;
  private bestMateDist2 = Infinity;
  private bestMateWeighted = Infinity;
  private selfPref = 0;
  // Parasite-mediated mate choice (Hamilton–Zuk, 078): active only when disease
  // and sexual mode are both on with a non-zero bias; otherwise these are inert
  // so the default scoring (and RNG stream) is byte-for-byte unchanged.
  private parasiteChoice = false;
  private parasiteBias = 0;

  // Social-brain foraging return (079): active only when `socialBrain` is on.
  // Inert otherwise, so feeding takes exactly the current `feed(...)` call and the
  // default run is byte-for-byte unchanged. The group counter is reused per eat.
  private socialBrain = false;
  private socialGain = 0;
  private socialSpecies = 0;
  private socialCount = 0;

  // Culture foraging return (080): active only when `culture` is on. Inert
  // otherwise (knowledge is 0 when culture is off, so the factor is exactly 1),
  // so the default run is byte-for-byte unchanged. No RNG (the copy/decay
  // bookkeeping is the separate culture pass).
  private culture = false;
  private knowledgeGain = 0;
  // Gene–culture coevolution (083): active only when `culture` is on and the
  // coupling is > 0. Re-weights the designated resource's (the plant staple) yield
  // by the eater's `size` band and `knowledge`, raising selection on `size` where
  // the practice is present. No RNG; inert (factor 1) when off ⇒ default unchanged.
  private geneCultureCoupling = 0;

  constructor(agentCapacity: number) {
    this.live = new Int32Array(agentCapacity);
    this.mated = new Uint8Array(agentCapacity);
    this.freakBirths = new Int32Array(agentCapacity);
    this.newborns = new Int32Array(agentCapacity);
  }

  private readonly onFood = (id: number, dist2: number): void => {
    // Prefer the diet-appropriate food type, but fall back to any if much closer.
    const preferred = this.selfDiet > 0.5 ? CARRION : PLANT;
    const weighted = this.world.foodType[id] === preferred ? dist2 : dist2 * FOOD_TYPE_PENALTY;
    if (weighted < this.bestFoodWeighted) {
      this.bestFoodWeighted = weighted;
      this.bestFood = id;
    }
  };

  private readonly onAgent = (id: number, dist2: number): void => {
    if (id === this.self) return;
    const w = this.world;

    // Threat: a larger, more carnivorous neighbour.
    if (
      w.traits[SIZE][id] > this.selfSize &&
      w.traits[DIET][id] > this.selfDiet &&
      dist2 < this.threatDist2
    ) {
      this.threatDist2 = dist2;
      this.threatX = w.x[id];
      this.threatY = w.y[id];
      this.hasThreat = true;
    }

    // Mate: the best-scoring compatible, mature, ready neighbour (only when self is
    // ready). Compatibility uses the ecological traits only; among compatible
    // candidates, the score balances proximity against how well the candidate's
    // display matches this creature's preference (sexual selection, v0.3.6).
    if (this.selfReady && isMature(w.age[id]) && w.energy[id] > this.threshold) {
      let d2 = 0;
      for (let t = 0; t < SPECIES_TRAIT_COUNT; t++) {
        const r = TRAIT_RANGES[t];
        const norm = (w.traits[t][id] - r.min) / (r.max - r.min);
        const diff = norm - this.selfNorm[t];
        d2 += diff * diff;
      }
      if (d2 < SPECIES_DISTANCE_THRESHOLD * SPECIES_DISTANCE_THRESHOLD) {
        const mismatch = Math.abs(w.traits[DISPLAY][id] - this.selfPref);
        // Parasite load (Hamilton–Zuk): an infected candidate is penalised by the
        // signed bias (positive ⇒ less attractive). No RNG; inert at bias 0 or
        // with disease off (parasiteChoice false), so the default run is unchanged.
        const parasite =
          this.parasiteChoice && w.infectionState[id] === INFECTED ? this.parasiteBias : 0;
        const weighted = dist2 * (1 + MATE_PREFERENCE_WEIGHT * mismatch + parasite);
        if (weighted < this.bestMateWeighted) {
          this.bestMateWeighted = weighted;
          this.bestMateDist2 = dist2;
          this.bestMate = id;
        }
      }
    }
  };

  /** Counts live conspecifics near a forager for the social-brain return (079). */
  private readonly onGroupMember = (id: number, _dist2: number): void => {
    if (this.world.alive[id] === 1 && this.world.speciesId[id] === this.socialSpecies) {
      this.socialCount++;
    }
  };

  /** Advance behaviour by one tick. Returns the number of births. */
  step(
    world: World,
    params: SimulationParameters,
    foodGrid: SpatialGrid,
    agentGrid: SpatialGrid,
    rng: Rng,
    pheromone?: PheromoneField,
  ): number {
    this.world = world;
    this.threshold = params.reproductionThreshold;
    // Parasite-mediated mate choice is active only in sexual mode with disease on
    // and a non-zero bias; otherwise the term is inert (default run unchanged).
    this.parasiteChoice =
      params.disease && params.sexualReproduction && params.parasiteMatingBias !== 0;
    this.parasiteBias = params.parasiteMatingBias;
    // Social-brain foraging return: active only when the toggle is on.
    this.socialBrain = params.socialBrain;
    this.socialGain = params.socialBrainGain;
    // Culture foraging return: active only when the toggle is on (knowledge is 0
    // otherwise, so the factor is exactly 1 and the default run is unchanged).
    this.culture = params.culture;
    this.knowledgeGain = params.knowledgeForagingGain;
    // Gene–culture coupling (083): inert unless culture is on and the coupling > 0.
    this.geneCultureCoupling = params.geneCultureCoupling;
    const usePheromones = params.pheromones && pheromone !== undefined;
    const { alive, x, y, vx, vy, energy, age, traits, agentCapacity } = world;
    const senseCol = traits[SENSE_RADIUS];
    const speedCol = traits[SPEED];
    const sizeCol = traits[SIZE];
    const dietCol = traits[DIET];

    // Snapshot the agents alive at the start of the tick so newborns wait.
    let n = 0;
    for (let s = 0; s < agentCapacity; s++) if (alive[s] === 1) this.live[n++] = s;
    if (params.sexualReproduction) this.mated.fill(0);
    this.freakBirthCount = 0;
    this.newbornCount = 0;

    let births = 0;
    for (let i = 0; i < n; i++) {
      const s = this.live[i];
      this.self = s;
      this.px = x[s];
      this.py = y[s];
      this.selfSize = sizeCol[s];
      this.selfDiet = dietCol[s];
      this.bestFood = -1;
      this.bestFoodWeighted = Infinity;
      this.hasThreat = false;
      this.threatDist2 = Infinity;
      this.bestMate = -1;
      this.bestMateDist2 = Infinity;
      this.bestMateWeighted = Infinity;

      this.selfReady = params.sexualReproduction && isMature(age[s]) && energy[s] > this.threshold;
      if (this.selfReady) {
        for (let t = 0; t < SPECIES_TRAIT_COUNT; t++) {
          const r = TRAIT_RANGES[t];
          this.selfNorm[t] = (traits[t][s] - r.min) / (r.max - r.min);
        }
        this.selfPref = traits[MATE_PREFERENCE][s];
      }

      const sense = senseCol[s];
      agentGrid.query(this.px, this.py, sense, this.onAgent);
      foodGrid.query(this.px, this.py, sense, this.onFood);

      // Heading: a learned net when brains are on, else flee / court / seek / wander.
      let dx: number;
      let dy: number;
      if (world.brainWeights !== null) {
        // Sensory inputs: normalised nearest-food and threat directions, energy, bias.
        let fdx = 0;
        let fdy = 0;
        if (this.bestFood !== -1) {
          fdx = world.foodX[this.bestFood] - this.px;
          fdy = world.foodY[this.bestFood] - this.py;
          const l = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
          fdx /= l;
          fdy /= l;
        }
        let tdx = 0;
        let tdy = 0;
        if (this.hasThreat) {
          tdx = this.px - this.threatX;
          tdy = this.py - this.threatY;
          const l = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
          tdx /= l;
          tdy /= l;
        }
        const inp = this.brainInputs;
        inp[0] = fdx;
        inp[1] = fdy;
        inp[2] = tdx;
        inp[3] = tdy;
        inp[4] = energy[s] / energyCapacity(sizeCol[s]);
        inp[5] = 1;
        evaluate(world.brainWeights, s * BRAIN_WEIGHT_COUNT, inp, this.brainOutputs);
        dx = this.brainOutputs[0];
        dy = this.brainOutputs[1];
        world.action[s] = this.hasThreat ? FLEEING : this.bestFood !== -1 ? SEEKING : IDLE;
      } else if (this.hasThreat) {
        dx = this.px - this.threatX;
        dy = this.py - this.threatY;
        world.action[s] = FLEEING;
      } else if (this.selfReady && this.bestMate !== -1) {
        dx = x[this.bestMate] - this.px;
        dy = y[this.bestMate] - this.py;
        world.action[s] = COURTING;
      } else if (this.bestFood !== -1) {
        dx = world.foodX[this.bestFood] - this.px;
        dy = world.foodY[this.bestFood] - this.py;
        world.action[s] = SEEKING;
      } else if (
        usePheromones &&
        pheromone!.sampleGradient(this.px, this.py) > PHEROMONE_GRADIENT_EPSILON
      ) {
        // No food sensed: climb the local pheromone trail.
        dx = pheromone!.gradX;
        dy = pheromone!.gradY;
        world.action[s] = IDLE;
      } else {
        const angle = rng.next() * TWO_PI;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        world.action[s] = IDLE;
      }

      // Move at the agent's speed.
      const speed = speedCol[s];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 1e-9) {
        vx[s] = (dx / len) * speed;
        vy[s] = (dy / len) * speed;
      } else {
        vx[s] = 0;
        vy[s] = 0;
      }
      const nx = clampPos(this.px + vx[s], params.worldWidth);
      const ny = clampPos(this.py + vy[s], params.worldHeight);
      x[s] = nx;
      y[s] = ny;

      // Eat the targeted food if reached and still available.
      const food = this.bestFood;
      if (food !== -1 && world.foodAlive[food] === 1) {
        const fdx = world.foodX[food] - nx;
        const fdy = world.foodY[food] - ny;
        if (fdx * fdx + fdy * fdy <= EAT_RADIUS * EAT_RADIUS) {
          let amount = world.foodEnergy[food];
          // Social-brain return (079): in a larger local conspecific group the
          // energy taken from food is multiplied by a small, bounded, saturating
          // factor scaled by `senseRadius`, so a big sense radius repays only in
          // company. Counted over the start-of-tick agent grid (which indexes this
          // creature and its neighbours), allocation-free, no RNG. Off ⇒ unchanged.
          if (this.socialBrain) {
            this.socialSpecies = world.speciesId[s];
            this.socialCount = 0;
            agentGrid.query(this.px, this.py, SOCIAL_GROUP_RADIUS, this.onGroupMember);
            amount *= socialForagingFactor(this.socialCount, senseCol[s], this.socialGain);
          }
          // Culture return (080): more knowledge yields more energy from the same
          // food, capped by `feed`. Knowledge is 0 when culture is off ⇒ factor 1.
          if (this.culture) {
            amount *= cultureForagingFactor(world.knowledge[s], this.knowledgeGain);
            // Gene–culture coevolution (083): the designated resource (the plant
            // staple) is unlocked by a high-knowledge practice only for the
            // above-band `size` genotype, raising selection on `size` where culture
            // is present. Deterministic, no RNG; factor 1 unless the coupling is on
            // and the unlock conditions hold (so it relaxes — reversibly — as
            // knowledge falls). Re-weights the yield within the energy budget
            // (`feed` caps).
            if (this.geneCultureCoupling > 0) {
              amount *= geneCultureFactor(
                world.foodType[food] === PLANT,
                sizeCol[s],
                world.knowledge[s],
                this.geneCultureCoupling,
              );
            }
          }
          feed(world, s, amount);
          consumeFood(world, food);
          world.action[s] = EATING;
          if (usePheromones) pheromone!.deposit(nx, ny, params.pheromoneDeposit);
        }
      }

      // Reproduce — sexually with a reached mate, or asexually.
      if (params.sexualReproduction) {
        const mate = this.bestMate;
        if (
          this.selfReady &&
          mate !== -1 &&
          this.mated[s] === 0 &&
          this.mated[mate] === 0 &&
          this.bestMateDist2 <= MATE_RADIUS * MATE_RADIUS &&
          alive[mate] === 1 &&
          energy[mate] > this.threshold &&
          isMature(age[mate])
        ) {
          const child = world.spawnAgent();
          if (child !== -1) {
            if (breedSexual(world, child, s, mate, params, rng)) {
              this.freakBirths[this.freakBirthCount++] = child;
            }
            const giveA = energy[s] * SEXUAL_COST_FRACTION;
            const giveB = energy[mate] * SEXUAL_COST_FRACTION;
            energy[s] -= giveA;
            energy[mate] -= giveB;
            energy[child] = giveA + giveB;
            x[child] = nx;
            y[child] = ny;
            vx[child] = 0;
            vy[child] = 0;
            world.speciesId[child] = world.speciesId[s];
            world.parentId[child] = world.id[s];
            world.generation[child] = Math.max(world.generation[s], world.generation[mate]) + 1;
            world.offspringCount[s]++;
            world.offspringCount[mate]++;
            this.newborns[this.newbornCount++] = child;
            this.mated[s] = 1;
            this.mated[mate] = 1;
            world.action[s] = COURTING;
            world.action[mate] = COURTING;
            births++;
          }
        }
      } else if (energy[s] > this.threshold && isMature(age[s])) {
        const child = world.spawnAgent();
        if (child !== -1) {
          if (breed(world, child, s, params, rng)) {
            this.freakBirths[this.freakBirthCount++] = child;
          }
          const give = energy[s] * REPRODUCTION_COST_FRACTION;
          energy[s] -= give;
          energy[child] = give;
          x[child] = nx;
          y[child] = ny;
          vx[child] = 0;
          vy[child] = 0;
          world.speciesId[child] = world.speciesId[s];
          world.parentId[child] = world.id[s];
          world.generation[child] = world.generation[s] + 1;
          world.offspringCount[s]++;
          this.newborns[this.newbornCount++] = child;
          births++;
        }
      }
    }
    return births;
  }
}

function clampPos(v: number, max: number): number {
  return v < 0 ? 0 : v > max ? max : v;
}
