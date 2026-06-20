import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import type { Rng } from './rng.ts';
import type { SpatialGrid } from './grid.ts';
import { SIZE, SPEED, SENSE_RADIUS, DIET } from './genome.ts';
import { feed } from './energy.ts';
import { consumeFood } from './food.ts';
import { breed } from './mutation.ts';
import { IDLE, SEEKING, EATING, FLEEING } from './state.ts';

const TWO_PI = Math.PI * 2;

/** Distance within which an agent eats the food it has reached. */
export const EAT_RADIUS = 4;
/** Energy gained from eating one food item (provisional; tuned in 012). */
export const FOOD_ENERGY = 25;
/** Fraction of the parent's energy handed to the offspring at reproduction. */
export const REPRODUCTION_COST_FRACTION = 0.5;

/**
 * The hand-coded, trait-parameterised behaviour policy (specification: Domain
 * rules → Behaviour, Reproduction). Each tick, every agent that was alive at the
 * start of the tick: flees the nearest larger, more carnivorous neighbour;
 * otherwise heads for the nearest food and eats it on arrival; otherwise
 * wanders. Agents above the reproduction threshold reproduce asexually,
 * splitting their energy with a mutated offspring.
 *
 * Reproduction is asexual in the first version; sexual crossover and its
 * configuration toggle are a later enhancement.
 *
 * Implemented as a reused object with bound visitors and a snapshot buffer so
 * the per-tick path allocates nothing.
 */
export class Behaviour {
  private readonly live: Int32Array;

  private world!: World;
  private self = -1;
  private px = 0;
  private py = 0;
  private selfSize = 0;
  private selfDiet = 0;

  private bestFood = -1;
  private bestFoodDist2 = Infinity;

  private hasThreat = false;
  private threatX = 0;
  private threatY = 0;
  private threatDist2 = Infinity;

  constructor(agentCapacity: number) {
    this.live = new Int32Array(agentCapacity);
  }

  private readonly onFood = (id: number, dist2: number): void => {
    if (dist2 < this.bestFoodDist2) {
      this.bestFoodDist2 = dist2;
      this.bestFood = id;
    }
  };

  private readonly onAgent = (id: number, dist2: number): void => {
    if (id === this.self) return;
    const w = this.world;
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
  };

  /** Advance behaviour by one tick. Returns the number of births. */
  step(
    world: World,
    params: SimulationParameters,
    foodGrid: SpatialGrid,
    agentGrid: SpatialGrid,
    rng: Rng,
  ): number {
    this.world = world;
    const { alive, x, y, vx, vy, energy, traits, agentCapacity } = world;
    const senseCol = traits[SENSE_RADIUS];
    const speedCol = traits[SPEED];
    const sizeCol = traits[SIZE];
    const dietCol = traits[DIET];

    // Snapshot the agents alive at the start of the tick so newborns wait.
    let n = 0;
    for (let s = 0; s < agentCapacity; s++) if (alive[s] === 1) this.live[n++] = s;

    let births = 0;
    for (let i = 0; i < n; i++) {
      const s = this.live[i];
      this.self = s;
      this.px = x[s];
      this.py = y[s];
      this.selfSize = sizeCol[s];
      this.selfDiet = dietCol[s];
      this.bestFood = -1;
      this.bestFoodDist2 = Infinity;
      this.hasThreat = false;
      this.threatDist2 = Infinity;

      const sense = senseCol[s];
      agentGrid.query(this.px, this.py, sense, this.onAgent);
      foodGrid.query(this.px, this.py, sense, this.onFood);

      // Choose a heading: flee, else seek food, else wander.
      let dx: number;
      let dy: number;
      if (this.hasThreat) {
        dx = this.px - this.threatX;
        dy = this.py - this.threatY;
        world.action[s] = FLEEING;
      } else if (this.bestFood !== -1) {
        dx = world.foodX[this.bestFood] - this.px;
        dy = world.foodY[this.bestFood] - this.py;
        world.action[s] = SEEKING;
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
          feed(world, s, FOOD_ENERGY);
          consumeFood(world, food);
          world.action[s] = EATING;
        }
      }

      // Reproduce asexually when over the threshold and the pool has room.
      if (energy[s] > params.reproductionThreshold) {
        const child = world.spawnAgent();
        if (child !== -1) {
          breed(world, child, s, params, rng);
          const give = energy[s] * REPRODUCTION_COST_FRACTION;
          energy[s] -= give;
          energy[child] = give;
          x[child] = nx;
          y[child] = ny;
          vx[child] = 0;
          vy[child] = 0;
          world.speciesId[child] = world.speciesId[s];
          world.generation[child] = world.generation[s] + 1;
          world.offspringCount[s]++;
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
