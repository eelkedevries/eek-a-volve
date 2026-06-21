import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Behaviour } from './behaviour.ts';
import { Predation } from './predation.ts';
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
import { MAX_POPULATION, spawnRandomAgent, immigrate, isNearExtinction } from './bounds.ts';

/** Spatial-grid cell size; a few times the typical sense radius keeps queries cheap. */
const GRID_CELL_SIZE = 32;

/** Re-cluster species every this many ticks (labels only; not every tick). */
const SPECIATION_INTERVAL = 60;

/** Spread of random ages given to the founding population. */
const FOUNDER_AGE_SPREAD = 900;

/** Deaths in a single tick beyond this floor, and beyond this fraction of the
 *  population, count as a (non-catastrophe) mass die-off worth logging. */
const MASS_DEATH_FLOOR = 10;
const MASS_DEATH_FRACTION = 0.04;

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
  private readonly speciation: Speciation;
  private readonly events = new Events();
  /** Bounded log of notable moments, drained by the worker for the UI and narrator. */
  readonly eventLog = new EventLog();
  /** Running hall-of-fame records, posted to the UI. */
  readonly records = new Records();

  tick = 0;
  /** Births during the most recent tick. */
  births = 0;
  /** Deaths during the most recent tick. */
  deaths = 0;
  /** Whether the population is currently near extinction. */
  nearExtinction = false;

  private prevSpeciesCount = 0;
  private prevNearExtinction = false;
  /** Optional WebAssembly core; null on the default (TS) path. */
  private readonly wasm: WasmCore | null;

  /** The most recent catastrophe event, if any (for display/narration). */
  get lastEvent(): CatastropheEvent | null {
    return this.events.last;
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
    this.world = new World(MAX_POPULATION, foodCapacity, wasmCore?.sharedBuffer);
    this.pheromone = new PheromoneField(params.worldWidth, params.worldHeight, params.pheromoneCellSize);
    this.agentGrid = new SpatialGrid(params.worldWidth, params.worldHeight, GRID_CELL_SIZE, MAX_POPULATION);
    this.foodGrid = new SpatialGrid(params.worldWidth, params.worldHeight, GRID_CELL_SIZE, foodCapacity);
    this.behaviour = new Behaviour(MAX_POPULATION);
    this.predation = new Predation();
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
    // 2. Behaviour: movement, eating, reproduction (and freak mutations).
    let births = behaviour.step(world, params, foodGrid, agentGrid, rng, this.pheromone);
    for (let i = 0; i < behaviour.freakBirthCount; i++) {
      const slot = behaviour.freakBirths[i];
      eventLog.freak(world.id[slot], slot, world.x[slot], world.y[slot]);
    }
    // Record this tick's parentage for the inspector's ancestry line (metadata only).
    for (let i = 0; i < behaviour.newbornCount; i++) {
      const slot = behaviour.newborns[i];
      this.lineage.record(world.id[slot], world.parentId[slot]);
    }
    // 3. Predation: carnivores eat smaller neighbours (positions have moved).
    let deaths = 0;
    if (params.predation) {
      agentGrid.rebuildFromAgents(world);
      deaths += this.predation.step(world, params, agentGrid);
    }
    // 4. Metabolism, ageing, death (optionally via the WebAssembly core).
    deaths +=
      this.wasm !== null ? this.wasm.metabolise(world, params) : metaboliseAndReap(world, params);
    // 5. Catastrophes (optional, behind the toggle).
    deaths += this.events.step(world, params, rng, this.tick);
    const catastrophe = this.events.last !== null && this.events.last.tick === this.tick;
    if (catastrophe && this.events.last !== null) {
      eventLog.catastrophe(this.events.last.kind, this.events.last.deaths);
    }
    // 6. Food regeneration (seasonally modulated) and carrion decay.
    if (this.wasm === null || !this.wasm.regenerateFood(world, params)) {
      regenerateFood(world, params, rng, this.tick);
    }
    if (this.wasm !== null) this.wasm.decayCarrion(world);
    else decayCarrion(world);
    // 6b. Pheromone field decay and diffusion (deterministic; only when enabled).
    if (params.pheromones) this.pheromone.step(params.pheromoneDecay, params.pheromoneDiffusion);
    // 7. Immigration (optional).
    births += immigrate(world, params, rng);
    // 8. Mass die-off (a death spike that was not itself a logged catastrophe).
    if (!catastrophe && deaths > MASS_DEATH_FLOOR && deaths > world.population * MASS_DEATH_FRACTION) {
      eventLog.massDeath(deaths);
    }
    // 9. Near-extinction detection (on the transition into it) and counters.
    this.nearExtinction = isNearExtinction(world);
    if (this.nearExtinction && !this.prevNearExtinction) eventLog.nearExtinction();
    this.prevNearExtinction = this.nearExtinction;
    this.births = births;
    this.deaths = deaths;
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
