import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { TRAIT_COUNT, TRAIT_RANGES, SIZE, SPEED, SENSE_RADIUS, DIET } from './genome.ts';
import { breedSexual } from './mutation.ts';
import { Behaviour } from './behaviour.ts';
import { createSimulation } from './loop.ts';

function grids(w: World, p: SimulationParameters): { food: SpatialGrid; agents: SpatialGrid } {
  const agents = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.agentCapacity);
  agents.rebuildFromAgents(w);
  const food = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.foodCapacity);
  return { food, agents };
}

describe('crossover (breedSexual)', () => {
  it('inherits each trait from one parent (no mutation)', () => {
    const w = new World(3, 1);
    const a = w.spawnAgent();
    const b = w.spawnAgent();
    const c = w.spawnAgent();
    for (let t = 0; t < TRAIT_COUNT; t++) {
      w.traits[t][a] = TRAIT_RANGES[t].min;
      w.traits[t][b] = TRAIT_RANGES[t].max;
    }
    const freak = breedSexual(w, c, a, b, { ...DEFAULT_PARAMETERS, mutationRate: 0 }, new Rng(7));
    if (!freak) {
      for (let t = 0; t < TRAIT_COUNT; t++) {
        const v = w.traits[t][c];
        expect(v === TRAIT_RANGES[t].min || v === TRAIT_RANGES[t].max).toBe(true);
      }
    }
  });

  it('keeps traits in range under heavy mutation', () => {
    const w = new World(3, 1);
    const a = w.spawnAgent();
    const b = w.spawnAgent();
    const c = w.spawnAgent();
    const mid = TRAIT_RANGES.map((r) => (r.min + r.max) / 2);
    for (let t = 0; t < TRAIT_COUNT; t++) {
      w.traits[t][a] = mid[t];
      w.traits[t][b] = mid[t];
    }
    breedSexual(w, c, a, b, { ...DEFAULT_PARAMETERS, mutationRate: 1, mutationMagnitude: 100 }, new Rng(3));
    for (let t = 0; t < TRAIT_COUNT; t++) {
      expect(w.traits[t][c]).toBeGreaterThanOrEqual(TRAIT_RANGES[t].min);
      expect(w.traits[t][c]).toBeLessThanOrEqual(TRAIT_RANGES[t].max);
    }
  });
});

describe('sexual reproduction (behaviour)', () => {
  const p: SimulationParameters = {
    ...DEFAULT_PARAMETERS,
    sexualReproduction: true,
    worldWidth: 200,
    worldHeight: 200,
    reproductionThreshold: 50,
    mutationRate: 0,
  };

  function adult(w: World, x: number, y: number): number {
    const s = w.spawnAgent();
    w.x[s] = x; w.y[s] = y; w.energy[s] = 100; w.age[s] = 400;
    w.traits[SIZE][s] = 1; w.traits[SPEED][s] = 0; w.traits[SENSE_RADIUS][s] = 50; w.traits[DIET][s] = 0;
    return s;
  }

  it('mates two ready, compatible, adjacent adults and credits both', () => {
    const w = new World(8, 1);
    const a = adult(w, 100, 100);
    const b = adult(w, 105, 100);
    const g = grids(w, p);
    const births = new Behaviour(w.agentCapacity).step(w, p, g.food, g.agents, new Rng(1));
    expect(births).toBe(1);
    expect(w.population).toBe(3);
    expect(w.offspringCount[a] + w.offspringCount[b]).toBe(2);
    expect(w.energy[a]).toBeLessThan(100); // both paid
    expect(w.energy[b]).toBeLessThan(100);
  });

  it('does not let a lone adult reproduce sexually', () => {
    const w = new World(8, 1);
    adult(w, 100, 100);
    const g = grids(w, p);
    expect(new Behaviour(w.agentCapacity).step(w, p, g.food, g.agents, new Rng(1))).toBe(0);
    expect(w.population).toBe(1);
  });

  it('keeps a dense population bounded with sexual reproduction on', () => {
    const sim = createSimulation({
      ...DEFAULT_PARAMETERS,
      seed: 1,
      sexualReproduction: true,
      worldWidth: 320,
      worldHeight: 320,
      initialPopulation: 160,
      foodAbundance: 260,
    });
    sim.run(2000);
    expect(sim.world.population).toBeGreaterThan(0);
    expect(sim.world.population).toBeLessThanOrEqual(sim.world.agentCapacity);
  }, 30000);
});
