import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Behaviour } from './behaviour.ts';
import { Predation } from './predation.ts';
import { Disease, seedInfections } from './disease.ts';
import { Culture } from './culture.ts';
import { Transitions } from './transitions.ts';
import { Speciation } from './speciation.ts';
import { Events, type CatastropheEvent } from './events.ts';
import { EventLog } from './eventlog.ts';
import { Records } from './records.ts';
import { Rng } from './rng.ts';
import { PheromoneField } from './pheromone.ts';
import { LineageRegistry } from './lineage.ts';
import type { SimulationParameters } from './params.ts';
import type { PopulationRecord } from './population.ts';
import { TRAIT_COUNT, SIZE, clampTrait } from './genome.ts';
import { metaboliseAndReap, energyCapacity } from './energy.ts';
import { BRAIN_WEIGHT_COUNT } from './brain.ts';
import type { WasmCore } from '../wasm/metabolismCore.ts';
import { seedFood, regenerateFood, decayCarrion, CARRION_RESERVE } from './food.ts';
import { spawnRandomAgent, immigrate, isNearExtinction } from './bounds.ts';
import { RescueTracker, type RescueMetric } from './rescue.ts';

/** Spatial-grid cell size; a few times the typical sense radius keeps queries cheap. */
export const GRID_CELL_SIZE = 32;

/** Re-cluster species every this many ticks (labels only; not every tick). */
const SPECIATION_INTERVAL = 60;

/** Spread of random ages given to the founding population. */
const FOUNDER_AGE_SPREAD = 900;

/** Deaths in a single tick beyond this floor, and beyond this fraction of the
 *  population, count as a (non-catastrophe) mass die-off worth logging. */
const MASS_DEATH_FLOOR = 10;
const MASS_DEATH_FRACTION = 0.04;

/** Fraction of the recent peak mean knowledge that must be lost to surface a
 *  "knowledge lost" event (the Tasmania loss, v0.7.2). Narration only. */
const CULTURE_LOSS_DROP = 0.5;
/** A peak mean knowledge below this is treated as "no real culture to lose", so a
 *  loss event only fires once a population has actually built knowledge up. */
const CULTURE_LOSS_FLOOR = 0.05;

/**
 * One fixed-timestep simulation. It owns the world, the reused spatial grids,
 * behaviour, generator, and counters, so a tick allocates nothing
 * (specification: Architecture — fixed-timestep loop; Determinism). The
 * accumulator, time multiplier, and ticks-per-frame cap belong to the worker /
 * render layer, not here.
 */
export class Simulation {
  readonly params: SimulationParameters;
  readonly world: World;
  readonly rng: Rng;
  /** Coarse pheromone field (stigmergy); inert unless `params.pheromones`. */
  readonly pheromone: PheromoneField;
  /** Bounded record of recent parentage, for the inspector's ancestry line. */
  readonly lineage = new LineageRegistry();
  private readonly agentGrid: SpatialGrid;
  private readonly foodGrid: SpatialGrid;
  private readonly behaviour: Behaviour;
  private readonly predation: Predation;
  private readonly disease: Disease;
  private readonly culture: Culture;
  /** Optional transitions / complexity-state pass ([design-abstraction] / [speculative],
   *  v0.8.0); inert unless `params.transitions`. */
  readonly transitions: Transitions;
  private readonly speciation: Speciation;
  private readonly events = new Events();
  /** Bounded log of notable moments, drained by the worker for the UI and narrator. */
  readonly eventLog = new EventLog();
  /** Running hall-of-fame records, posted to the UI. */
  readonly records = new Records();
  /** Observational evolutionary-rescue / reversibility metric (v0.7.4). Fed the
   *  per-tick population (already computed); never read back into a decision, so it
   *  adds no RNG and leaves determinism and the default run untouched. */
  private readonly rescueTracker = new RescueTracker();

  tick = 0;
  /** Births during the most recent tick. */
  births = 0;
  /** Deaths during the most recent tick. */
  deaths = 0;
  /** Whether the population is currently near extinction. */
  nearExtinction = false;

  private prevSpeciesCount = 0;
  private prevNearExtinction = false;
  /** Recent high-water mark of mean knowledge, for the Tasmania loss event (v0.7.2). */
  private peakMeanKnowledge = 0;
  /** Whether a "knowledge lost" event has already fired for the current decline. */
  private cultureLossFlagged = false;
  /** Optional WebAssembly core; null on the default (TS) path. */
  private readonly wasm: WasmCore | null;

  /** The most recent catastrophe event, if any (for display/narration). */
  get lastEvent(): CatastropheEvent | null {
    return this.events.last;
  }

  /**
   * Read-only evolutionary-rescue / reversibility metric (v0.7.4): the deepest
   * population trough seen so far and its tick, the pre-trough baseline, and the
   * recovery time to a target fraction of that baseline. Derived entirely from the
   * per-tick population the loop already tracks; observational only (never read back
   * into a simulation decision), so it does not affect determinism.
   */
  get rescue(): RescueMetric {
    return this.rescueTracker.snapshot();
  }

  constructor(
    params: SimulationParameters,
    population?: PopulationRecord[],
    wasmCore?: WasmCore,
  ) {
    this.params = params;
    this.wasm = wasmCore ?? null;
    this.rng = new Rng(params.seed);
    this.wasm?.setRng(this.rng);
    const foodCapacity = params.foodAbundance + CARRION_RESERVE;
    this.world = new World(params.maxPopulation, foodCapacity, wasmCore?.sharedBuffer);
    this.pheromone = new PheromoneField(
      params.worldWidth,
      params.worldHeight,
      params.pheromoneCellSize,
      this.wasm?.pheromoneArrays,
    );
    this.agentGrid = new SpatialGrid(
      params.worldWidth,
      params.worldHeight,
      GRID_CELL_SIZE,
      params.maxPopulation,
      this.wasm?.agentGridArrays,
    );
    this.foodGrid = new SpatialGrid(
      params.worldWidth,
      params.worldHeight,
      GRID_CELL_SIZE,
      foodCapacity,
      this.wasm?.foodGridArrays,
    );
    this.behaviour = new Behaviour(params.maxPopulation);
    this.predation = new Predation();
    this.disease = new Disease(params.maxPopulation);
    this.culture = new Culture(params.maxPopulation);
    this.transitions = new Transitions(params.worldWidth, params.worldHeight);
    this.speciation = new Speciation();
    if (params.neuralBrains) this.world.enableBrains(BRAIN_WEIGHT_COUNT);
    if (population !== undefined && population.length > 0) this.seedFromPopulation(population);
    else this.seed();
  }

  /** Advance the simulation by one tick. */
  step(): void {
    const { world, params, rng, agentGrid, foodGrid, behaviour, eventLog } = this;
    eventLog.setTick(this.tick);
    // 1. Rebuild spatial indices from current positions.
    agentGrid.rebuildFromAgents(world);
    this.rebuildFoodGrid();
    // 2. Behaviour: movement, eating, reproduction (and freak mutations). Run in the
    // WASM core when it can (no brains, no pheromones), else the TypeScript pass.
    let births: number;
    let freakBirths: Int32Array;
    let freakBirthCount: number;
    let newborns: Int32Array;
    let newbornCount: number;
    if (this.wasm !== null && this.wasm.canRunBehaviour(params)) {
      births = this.wasm.behaviourStep(world, params);
      freakBirths = this.wasm.freakBirths;
      freakBirthCount = this.wasm.freakBirthCount;
      newborns = this.wasm.newborns;
      newbornCount = this.wasm.newbornCount;
    } else {
      births = behaviour.step(world, params, foodGrid, agentGrid, rng, this.pheromone);
      freakBirths = behaviour.freakBirths;
      freakBirthCount = behaviour.freakBirthCount;
      newborns = behaviour.newborns;
      newbornCount = behaviour.newbornCount;
    }
    for (let i = 0; i < freakBirthCount; i++) {
      const slot = freakBirths[i];
      eventLog.freak(world.id[slot], slot, world.x[slot], world.y[slot]);
    }
    // Record this tick's parentage for the inspector's ancestry line (metadata only).
    for (let i = 0; i < newbornCount; i++) {
      const slot = newborns[i];
      this.lineage.record(world.id[slot], world.parentId[slot]);
    }
    // 3. Predation: carnivores eat smaller neighbours (positions have moved).
    let deaths = 0;
    if (params.predation) {
      agentGrid.rebuildFromAgents(world);
      deaths +=
        this.wasm !== null && this.wasm.canRunBehaviour(params)
          ? this.wasm.predationStep(world)
          : this.predation.step(world, params, agentGrid, rng);
    }
    // 4. Metabolism, ageing, death (optionally via the WebAssembly core). The
    // optional cognition cost, the disease resistance cost, and a non-unit
    // metabolic exponent live only in the TS metabolism pass, so when any is
    // active the WASM core falls back to TS here (the kernel is not re-derived).
    // Culture also forces the TS path so the whole knowledge subsystem stays
    // TS-only (WASM-fallback rule), even though it does not change metabolic cost.
    deaths +=
      this.wasm !== null &&
      params.cognitionCost === 0 &&
      !params.disease &&
      params.metabolicExponent === 1 &&
      !params.culture
        ? this.wasm.metabolise(world, params)
        : metaboliseAndReap(world, params);
    // 4b. Disease (optional, behind the toggle): infect susceptible grid
    // neighbours, advance infection timers to recovery or disease death (routed
    // through the normal death path so its deaths add into this tick's total).
    let diseaseDeaths = 0;
    if (params.disease) {
      agentGrid.rebuildFromAgents(world);
      diseaseDeaths = this.disease.step(world, params, agentGrid, rng);
      deaths += diseaseDeaths;
    }
    // 4c. Culture (optional, behind the toggle): copy a fraction of the best
    // reachable neighbour's knowledge toward each agent and optionally decay it
    // (the foraging return itself is applied in the behaviour/feeding pass). Its
    // own pass over current positions; draws no RNG and changes nothing when off.
    // When the reachable population is sub-critical the pass throttles maintenance,
    // so mean knowledge falls; a marked drop from its recent peak surfaces a
    // "knowledge lost" event (narration metadata only, never read back).
    if (params.culture) {
      agentGrid.rebuildFromAgents(world);
      this.culture.step(world, params, agentGrid, rng);
      this.detectCultureLoss(world);
    }
    // 5. Catastrophes (optional, behind the toggle).
    deaths += this.events.step(world, params, rng, this.tick);
    const catastrophe = this.events.last !== null && this.events.last.tick === this.tick;
    if (catastrophe && this.events.last !== null) {
      eventLog.catastrophe(this.events.last.kind, this.events.last.deaths);
    }
    // 5b. Transitions / complexity state (optional, behind the toggle): a per-region
    // detector over current density + mean knowledge flips a local complexity state
    // that raises then degrades local food regeneration (overshoot/decline/recovery),
    // with an explicit degradation hazard keeping it non-absorbing. Updates per-region
    // scalars the food pass consults; draws RNG only when on, and changes nothing when
    // off. Run before food regeneration so this tick's regen reflects the new state.
    if (params.transitions) this.transitions.step(world, params, rng);
    // 6. Food regeneration (seasonally modulated) and carrion decay. When transitions is
    // on, food regeneration runs in TypeScript (the WASM kernel has no region logic, so
    // it returns false and we fall back) and is biased by the per-region multiplier.
    if (
      this.wasm === null ||
      params.transitions ||
      !this.wasm.regenerateFood(world, params, this.tick)
    ) {
      regenerateFood(world, params, rng, this.tick, params.transitions ? this.transitions : undefined);
    }
    if (this.wasm !== null) this.wasm.decayCarrion(world);
    else decayCarrion(world);
    // 6b. Pheromone field decay and diffusion (deterministic; only when enabled).
    if (params.pheromones) {
      if (this.wasm !== null && this.wasm.canRunBehaviour(params)) this.wasm.pheromoneStep(params);
      else this.pheromone.step(params.pheromoneDecay, params.pheromoneDiffusion);
    }
    // 7. Immigration (optional).
    births += immigrate(world, params, rng);
    // 8. Mass die-off (a death spike that was not itself a logged catastrophe). When
    // most of the spike was disease, flag it as a plague die-off so the feed reads as
    // disease — the same spike path, only a different flavour (no outcome change).
    if (!catastrophe && deaths > MASS_DEATH_FLOOR && deaths > world.population * MASS_DEATH_FRACTION) {
      if (diseaseDeaths * 2 > deaths) eventLog.plagueDeath(deaths);
      else eventLog.massDeath(deaths);
    }
    // 9. Near-extinction detection (on the transition into it) and counters.
    this.nearExtinction = isNearExtinction(world);
    if (this.nearExtinction && !this.prevNearExtinction) eventLog.nearExtinction();
    this.prevNearExtinction = this.nearExtinction;
    this.births = births;
    this.deaths = deaths;
    // Observational rescue/reversibility metric (v0.7.4): feed this tick's already-
    // computed population to the tracker. Pure scalar work, no allocation, no RNG,
    // and never read back into a decision — so determinism is untouched.
    this.rescueTracker.observe(world.population, this.tick);
    // 10. Obituaries for notable creatures that died this tick, and records.
    eventLog.reconcile(world);
    this.records.update(world, this.tick);
    this.tick++;
    if (this.tick % SPECIATION_INTERVAL === 0) {
      const count = this.speciation.cluster(world);
      if (count > this.prevSpeciesCount) eventLog.species(count);
      this.prevSpeciesCount = count;
    }
  }

  /** Advance the simulation by `ticks` ticks. */
  run(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.step();
  }

  /**
   * Surface a "knowledge lost" event (the Tasmania loss, v0.7.2) when mean
   * knowledge falls markedly from its recent peak — the legible signature of a
   * sub-critical population failing to maintain its culture. Tracks the peak as a
   * high-water mark and fires once per decline, re-arming when knowledge recovers
   * past the peak (so the U-shape can repeat). Narration metadata only: it reads
   * the world but is never read back into a simulation decision, so determinism is
   * unaffected.
   */
  private detectCultureLoss(world: World): void {
    const { alive, knowledge, agentCapacity } = world;
    let sum = 0;
    let n = 0;
    for (let s = 0; s < agentCapacity; s++) {
      if (alive[s] === 0) continue;
      sum += knowledge[s];
      n++;
    }
    const mean = n > 0 ? sum / n : 0;
    if (mean > this.peakMeanKnowledge) {
      // New high-water mark: culture is being built or rebuilt — re-arm the event.
      this.peakMeanKnowledge = mean;
      this.cultureLossFlagged = false;
    } else if (
      !this.cultureLossFlagged &&
      this.peakMeanKnowledge > CULTURE_LOSS_FLOOR &&
      mean < this.peakMeanKnowledge * (1 - CULTURE_LOSS_DROP)
    ) {
      // Marked decline from a real peak: a knowledge-lost moment.
      this.eventLog.cultureLoss();
      this.cultureLossFlagged = true;
    }
  }

  private seed(): void {
    const { world, params, rng } = this;
    const species = Math.max(1, params.startingSpeciesCount);
    const target = Math.min(params.initialPopulation, world.agentCapacity);
    for (let i = 0; i < target; i++) {
      const slot = spawnRandomAgent(world, params, rng, i % species);
      // Vary founder ages so the starting population is not all juveniles at
      // once (which would force a birth-less crash before any can mature).
      if (slot !== -1) world.age[slot] = rng.int(FOUNDER_AGE_SPREAD);
    }
    seedFood(world, params, rng);
    // Seed the initial infection when disease is on (draws no RNG when off).
    seedInfections(world, params, rng);
    this.prevSpeciesCount = this.speciation.cluster(world);
  }

  /**
   * Seed from an imported population instead of random founders. Traits and state
   * are clamped to valid ranges; creatures get fresh ids (so the resumed run has
   * its own lineage). Species labels are reassigned by the clustering pass.
   */
  private seedFromPopulation(records: PopulationRecord[]): void {
    const { world, params, rng } = this;
    const target = Math.min(records.length, world.agentCapacity);
    for (let i = 0; i < target; i++) {
      const r = records[i];
      const slot = world.spawnAgent();
      if (slot === -1) break;
      for (let t = 0; t < TRAIT_COUNT; t++) world.traits[t][slot] = clampTrait(t, r.traits[t]);
      world.x[slot] = r.x < 0 ? 0 : r.x > params.worldWidth ? params.worldWidth : r.x;
      world.y[slot] = r.y < 0 ? 0 : r.y > params.worldHeight ? params.worldHeight : r.y;
      const cap = energyCapacity(world.traits[SIZE][slot]);
      world.energy[slot] = Math.min(Math.max(1, r.energy), cap);
      world.age[slot] = r.age;
      world.generation[slot] = r.generation;
      world.vx[slot] = 0;
      world.vy[slot] = 0;
      // The save carries no brain weights, so give imported creatures fresh ones.
      if (world.brainWeights !== null) {
        const b = slot * BRAIN_WEIGHT_COUNT;
        for (let k = 0; k < BRAIN_WEIGHT_COUNT; k++) world.brainWeights[b + k] = rng.next() * 2 - 1;
      }
    }
    seedFood(world, params, rng);
    // Seed the initial infection when disease is on (draws no RNG when off).
    seedInfections(world, params, rng);
    this.prevSpeciesCount = this.speciation.cluster(world);
  }

  private rebuildFoodGrid(): void {
    const { foodGrid, world } = this;
    foodGrid.clear();
    const { foodAlive, foodX, foodY, foodCapacity } = world;
    for (let s = 0; s < foodCapacity; s++) {
      if (foodAlive[s] === 1) foodGrid.insert(s, foodX[s], foodY[s]);
    }
  }
}

/** Create a fully seeded simulation from a parameter set, optionally from a saved
 *  population and an optional WebAssembly core (else the TS core runs). */
export function createSimulation(
  params: SimulationParameters,
  population?: PopulationRecord[],
  wasmCore?: WasmCore,
): Simulation {
  return new Simulation(params, population, wasmCore);
}
