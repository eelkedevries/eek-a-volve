import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import {
  Disease,
  infectionDuration,
  seedInfections,
  TRANSMISSION_RADIUS,
  SUSCEPTIBLE,
  INFECTED,
  RECOVERED,
} from './disease.ts';
import { createSimulation, GRID_CELL_SIZE } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, DIET, RESISTANCE } from './genome.ts';
import { CARRION } from './food.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 300, worldHeight: 300, ...over };
}

/**
 * A world with `n` clustered, susceptible herbivores plus one infected patient
 * zero. By default patient zero stays infectious indefinitely (so a focused
 * transmission test can observe spread); pass `patientZeroTimer` to let it recover
 * on the same schedule as everyone else.
 */
function clusteredWorld(n: number, spacing: number, patientZeroTimer = 9999): World {
  const w = new World(256, 16);
  for (let i = 0; i < n; i++) {
    const s = w.spawnAgent();
    w.x[s] = 100 + (i % 16) * spacing;
    w.y[s] = 100 + Math.floor(i / 16) * spacing;
    w.traits[SIZE][s] = 1;
    w.traits[DIET][s] = 0;
    w.infectionState[s] = i === 0 ? INFECTED : SUSCEPTIBLE;
    if (i === 0) w.infectionTimer[s] = patientZeroTimer;
  }
  return w;
}

/** Count infected agents in a world. */
function prevalence(w: World): number {
  let infected = 0;
  for (let s = 0; s < w.agentCapacity; s++) if (w.alive[s] === 1 && w.infectionState[s] === INFECTED) infected++;
  return infected;
}

describe('disease — infection duration', () => {
  it('derives a longer infectious period from a slower recovery rate', () => {
    expect(infectionDuration(0.1)).toBe(10);
    expect(infectionDuration(0.02)).toBe(50);
    expect(infectionDuration(0.1)).toBeLessThan(infectionDuration(0.02));
    expect(infectionDuration(0)).toBeGreaterThan(0); // never zero-length
  });
});

describe('disease — default-off is inert', () => {
  it('draws no RNG and advances no columns when disease is off', () => {
    const w = clusteredWorld(20, 2);
    const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
    grid.rebuildFromAgents(w);
    const before = prevalence(w);
    const rng = new Rng(1);
    // Two generators: one passed to the (off) pass, one a pristine reference.
    const ref = new Rng(1);
    const deaths = new Disease(w.agentCapacity).step(w, params({ disease: false }), grid, rng);
    expect(deaths).toBe(0);
    expect(prevalence(w)).toBe(before); // unchanged
    expect(rng.next()).toBe(ref.next()); // the stream did not advance
  });

  it('seedInfections is a no-op when disease is off', () => {
    const w = clusteredWorld(20, 2);
    for (let s = 0; s < w.agentCapacity; s++) if (w.alive[s]) w.infectionState[s] = SUSCEPTIBLE;
    const rng = new Rng(3);
    const ref = new Rng(3);
    seedInfections(w, params({ disease: false }), rng);
    expect(prevalence(w)).toBe(0);
    expect(rng.next()).toBe(ref.next());
  });
});

describe('disease — density-dependent transmission', () => {
  it('spreads faster through a denser cluster than a sparse one', () => {
    expect(TRANSMISSION_RADIUS).toBeGreaterThan(0);
    const p = params({ disease: true, transmissionRate: 0.2, recoveryRate: 0.001, diseaseMortality: 0 });

    const runFor = (spacing: number, ticks: number): number => {
      const w = clusteredWorld(40, spacing);
      const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
      const disease = new Disease(w.agentCapacity);
      const rng = new Rng(7);
      for (let t = 0; t < ticks; t++) {
        grid.rebuildFromAgents(w);
        disease.step(w, p, grid, rng);
      }
      return prevalence(w);
    };

    // Dense: neighbours within the transmission radius. Sparse: spread far apart.
    const dense = runFor(2, 8);
    const sparse = runFor(TRANSMISSION_RADIUS * 2, 8);
    expect(dense).toBeGreaterThan(sparse);
    expect(dense).toBeGreaterThan(1); // the epidemic actually grew
  });

  it('resistant hosts are infected less than susceptible ones', () => {
    const p = params({ disease: true, transmissionRate: 0.3, recoveryRate: 0.001, diseaseMortality: 0 });
    const infectedAmong = (resistance: number): number => {
      const w = clusteredWorld(40, 2);
      for (let s = 0; s < w.agentCapacity; s++) if (w.alive[s]) w.traits[RESISTANCE][s] = resistance;
      // re-mark patient zero (overwritten by the resistance loop? no — only the trait changed)
      const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
      const disease = new Disease(w.agentCapacity);
      const rng = new Rng(11);
      for (let t = 0; t < 6; t++) {
        grid.rebuildFromAgents(w);
        disease.step(w, p, grid, rng);
      }
      return prevalence(w);
    };
    expect(infectedAmong(1)).toBeLessThan(infectedAmong(0));
  });
});

describe('disease — recovery, immunity, and death routing', () => {
  it('SIR burns out: recovered hosts accumulate and infection clears', () => {
    const p = params({ disease: true, transmissionRate: 0.25, recoveryRate: 0.2, diseaseMortality: 0, immunityMode: 'sir' });
    const w = clusteredWorld(40, 2, infectionDuration(0.2));
    const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
    const disease = new Disease(w.agentCapacity);
    const rng = new Rng(5);
    for (let t = 0; t < 400; t++) {
      grid.rebuildFromAgents(w);
      disease.step(w, p, grid, rng);
    }
    let recovered = 0;
    for (let s = 0; s < w.agentCapacity; s++) if (w.alive[s] === 1 && w.infectionState[s] === RECOVERED) recovered++;
    expect(prevalence(w)).toBe(0); // epidemic has burned out
    expect(recovered).toBeGreaterThan(0); // immunity accumulated
  });

  it('SIS can persist: recovered return to susceptible so infection lingers', () => {
    const sir = params({ disease: true, transmissionRate: 0.25, recoveryRate: 0.1, diseaseMortality: 0, immunityMode: 'sir' });
    const sis = { ...sir, immunityMode: 'sis' as const };
    const finalPrevalence = (pp: SimulationParameters): number => {
      const w = clusteredWorld(60, 2, infectionDuration(0.1));
      const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
      const disease = new Disease(w.agentCapacity);
      const rng = new Rng(13);
      for (let t = 0; t < 300; t++) {
        grid.rebuildFromAgents(w);
        disease.step(w, pp, grid, rng);
      }
      return prevalence(w);
    };
    // Under SIS the pool of susceptibles is replenished, so infection persists
    // where SIR (which exhausts susceptibles into immunity) burns out.
    expect(finalPrevalence(sis)).toBeGreaterThan(finalPrevalence(sir));
  });

  it('disease deaths drop carrion and are counted (routed through the normal death path)', () => {
    // Certain mortality on a short infection: patient zero dies this very tick.
    const p = params({ disease: true, transmissionRate: 0, recoveryRate: 1, diseaseMortality: 1 });
    const w = new World(16, 16);
    const s = w.spawnAgent();
    w.x[s] = 50;
    w.y[s] = 50;
    w.traits[SIZE][s] = 1.5;
    w.infectionState[s] = INFECTED;
    w.infectionTimer[s] = 1; // ends this tick
    const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
    grid.rebuildFromAgents(w);
    const popBefore = w.population;
    const carrionBefore = w.carrionCount;
    const deaths = new Disease(w.agentCapacity).step(w, p, grid, new Rng(1));
    expect(deaths).toBe(1);
    expect(w.alive[s]).toBe(0); // killed via killAgent
    expect(w.population).toBe(popBefore - 1);
    expect(w.carrionCount).toBe(carrionBefore + 1); // carrion dropped at the death site
    let carrion = 0;
    for (let f = 0; f < w.foodCapacity; f++) if (w.foodAlive[f] === 1 && w.foodType[f] === CARRION) carrion++;
    expect(carrion).toBe(1);
  });
});

describe('disease — determinism and stability in the full loop', () => {
  it('reproduces a run exactly with disease on (SIR)', () => {
    const p = params({ disease: true, initialPopulation: 140, foodAbundance: 260, seed: 5 });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(400);
      return {
        population: sim.world.population,
        x: Array.from(sim.world.x),
        infectionState: Array.from(sim.world.infectionState),
        infectionTimer: Array.from(sim.world.infectionTimer),
      };
    };
    expect(run()).toEqual(run());
  });

  it('reproduces a run exactly with disease on (SIS)', () => {
    const p = params({ disease: true, immunityMode: 'sis', initialPopulation: 140, foodAbundance: 260, seed: 8 });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(400);
      return { population: sim.world.population, infectionState: Array.from(sim.world.infectionState) };
    };
    expect(run()).toEqual(run());
  });

  it('keeps a population bounded and alive under disease pressure (no guaranteed extinction)', () => {
    const sim = createSimulation(
      params({ disease: true, initialPopulation: 160, foodAbundance: 260, seed: 3 }),
    );
    sim.run(2000);
    expect(sim.world.population).toBeGreaterThan(0);
    expect(sim.world.population).toBeLessThanOrEqual(sim.world.agentCapacity);
  }, 30000);

  it('actually drives infections in a dense seeded run', () => {
    // Over a community-dense run some creatures should be infected at some point.
    const sim = createSimulation(
      params({
        disease: true,
        transmissionRate: 0.1,
        recoveryRate: 0.02,
        diseaseMortality: 0.05,
        worldWidth: 240,
        worldHeight: 240,
        initialPopulation: 180,
        foodAbundance: 260,
        seed: 4,
      }),
    );
    let everInfected = false;
    for (let t = 0; t < 300 && !everInfected; t++) {
      sim.step();
      if (prevalence(sim.world) > 0) everInfected = true;
    }
    expect(everInfected).toBe(true);
  }, 30000);
});
