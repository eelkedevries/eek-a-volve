import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Behaviour } from './behaviour.ts';
import { Predation } from './predation.ts';
import { Speciation } from './speciation.ts';
import { Events, type CatastropheEvent } from './events.ts';
import { Rng } from './rng.ts';
import type { SimulationParameters } from './params.ts';
import { metaboliseAndReap } from './energy.ts';
import { seedFood, regenerateFood, decayCarrion, CARRION_RESERVE } from './food.ts';
import { MAX_POPULATION, spawnRandomAgent, immigrate, isNearExtinction } from './bounds.ts';

/** Spatial-grid cell size; a few times the typical sense radius keeps queries cheap. */
const GRID_CELL_SIZE = 32;

/** Re-cluster species every this many ticks (labels only; not every tick). */
const SPECIATION_INTERVAL = 60;

/** Spread of random ages given to the founding population. */
const FOUNDER_AGE_SPREAD = 900;

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
  private readonly agentGrid: SpatialGrid;
  private readonly foodGrid: SpatialGrid;
  private readonly behaviour: Behaviour;
  private readonly predation: Predation;
  private readonly speciation: Speciation;
  private readonly events = new Events();

  tick = 0;
  /** Births during the most recent tick. */
  births = 0;
  /** Deaths during the most recent tick. */
  deaths = 0;
  /** Whether the population is currently near extinction. */
  nearExtinction = false;

  /** The most recent catastrophe event, if any (for display/narration). */
  get lastEvent(): CatastropheEvent | null {
    return this.events.last;
  }

  constructor(params: SimulationParameters) {
    this.params = params;
    this.rng = new Rng(params.seed);
    const foodCapacity = params.foodAbundance + CARRION_RESERVE;
    this.world = new World(MAX_POPULATION, foodCapacity);
    this.agentGrid = new SpatialGrid(params.worldWidth, params.worldHeight, GRID_CELL_SIZE, MAX_POPULATION);
    this.foodGrid = new SpatialGrid(params.worldWidth, params.worldHeight, GRID_CELL_SIZE, foodCapacity);
    this.behaviour = new Behaviour(MAX_POPULATION);
    this.predation = new Predation();
    this.speciation = new Speciation();
    this.seed();
  }

  /** Advance the simulation by one tick. */
  step(): void {
    const { world, params, rng, agentGrid, foodGrid, behaviour } = this;
    // 1. Rebuild spatial indices from current positions.
    agentGrid.rebuildFromAgents(world);
    this.rebuildFoodGrid();
    // 2. Behaviour: movement, eating, asexual reproduction.
    let births = behaviour.step(world, params, foodGrid, agentGrid, rng);
    // 3. Predation: carnivores eat smaller neighbours (positions have moved).
    let deaths = 0;
    if (params.predation) {
      agentGrid.rebuildFromAgents(world);
      deaths += this.predation.step(world, params, agentGrid);
    }
    // 4. Metabolism, ageing, death.
    deaths += metaboliseAndReap(world, params);
    // 5. Catastrophes (optional, behind the toggle).
    deaths += this.events.step(world, params, rng, this.tick);
    // 4. Food regeneration and carrion decay.
    regenerateFood(world, params, rng);
    decayCarrion(world);
    // 5. Immigration (optional).
    births += immigrate(world, params, rng);
    // 6. Near-extinction detection and counters.
    this.nearExtinction = isNearExtinction(world);
    this.births = births;
    this.deaths = deaths;
    this.tick++;
    if (this.tick % SPECIATION_INTERVAL === 0) this.speciation.cluster(world);
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
    this.speciation.cluster(world);
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

/** Create a fully seeded simulation from a parameter set. */
export function createSimulation(params: SimulationParameters): Simulation {
  return new Simulation(params);
}
