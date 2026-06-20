import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, SPEED, SENSE_RADIUS, DIET } from './genome.ts';
import { Behaviour, FOOD_ENERGY } from './behaviour.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 200, worldHeight: 200, ...over };
}

function buildGrids(w: World, p: SimulationParameters): { food: SpatialGrid; agents: SpatialGrid } {
  const agents = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.agentCapacity);
  agents.rebuildFromAgents(w);
  const food = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.foodCapacity);
  for (let s = 0; s < w.foodCapacity; s++) if (w.foodAlive[s]) food.insert(s, w.foodX[s], w.foodY[s]);
  return { food, agents };
}

describe('Behaviour', () => {
  it('moves toward and eats nearby food', () => {
    const p = params({ reproductionThreshold: 1e9 });
    const w = new World(4, 4);
    const a = w.spawnAgent();
    w.x[a] = 100; w.y[a] = 100; w.energy[a] = 20;
    w.traits[SIZE][a] = 1; w.traits[SPEED][a] = 5; w.traits[SENSE_RADIUS][a] = 50; w.traits[DIET][a] = 0;
    const f = w.spawnFood();
    w.foodX[f] = 103; w.foodY[f] = 100;
    const { food, agents } = buildGrids(w, p);
    new Behaviour(w.agentCapacity).step(w, p, food, agents, new Rng(1));
    expect(w.x[a]).toBeGreaterThan(100);
    expect(w.foodAlive[f]).toBe(0);
    expect(w.energy[a]).toBe(20 + FOOD_ENERGY);
  });

  it('flees a larger, more carnivorous neighbour', () => {
    const p = params({ reproductionThreshold: 1e9 });
    const w = new World(4, 1);
    const prey = w.spawnAgent();
    w.x[prey] = 100; w.y[prey] = 100; w.energy[prey] = 20;
    w.traits[SIZE][prey] = 1; w.traits[SPEED][prey] = 3; w.traits[SENSE_RADIUS][prey] = 50; w.traits[DIET][prey] = 0.2;
    const pred = w.spawnAgent();
    w.x[pred] = 110; w.y[pred] = 100; w.energy[pred] = 20;
    w.traits[SIZE][pred] = 2; w.traits[SPEED][pred] = 0; w.traits[SENSE_RADIUS][pred] = 50; w.traits[DIET][pred] = 0.9;
    const { food, agents } = buildGrids(w, p);
    new Behaviour(w.agentCapacity).step(w, p, food, agents, new Rng(1));
    expect(w.x[prey]).toBeLessThan(100); // moved away from the predator at x=110
  });

  it('reproduces asexually above the threshold, splitting energy', () => {
    const p = params({ reproductionThreshold: 50, mutationRate: 0 });
    const w = new World(8, 1);
    const a = w.spawnAgent();
    w.x[a] = 50; w.y[a] = 50; w.energy[a] = 100;
    w.traits[SIZE][a] = 1; w.traits[SPEED][a] = 0; w.traits[SENSE_RADIUS][a] = 10; w.traits[DIET][a] = 0;
    w.speciesId[a] = 7;
    w.age[a] = 300; // mature
    const { food, agents } = buildGrids(w, p);
    const births = new Behaviour(w.agentCapacity).step(w, p, food, agents, new Rng(1));
    expect(births).toBe(1);
    expect(w.population).toBe(2);
    let child = -1;
    for (let s = 0; s < w.agentCapacity; s++) if (w.alive[s] && s !== a) child = s;
    expect(child).not.toBe(-1);
    expect(w.speciesId[child]).toBe(7);
    expect(w.energy[a]).toBeCloseTo(50);
    expect(w.energy[child]).toBeCloseTo(50);
  });

  it('is deterministic for a given seed and setup', () => {
    const run = (): unknown => {
      const p = params();
      const w = new World(16, 16);
      for (let i = 0; i < 8; i++) {
        const s = w.spawnAgent();
        w.x[s] = (i * 20) % 200; w.y[s] = (i * 30) % 200; w.energy[s] = 60;
        w.traits[SIZE][s] = 1; w.traits[SPEED][s] = 2; w.traits[SENSE_RADIUS][s] = 40; w.traits[DIET][s] = 0.5;
      }
      for (let i = 0; i < 10; i++) {
        const f = w.spawnFood();
        w.foodX[f] = (i * 17) % 200; w.foodY[f] = (i * 23) % 200;
      }
      const { food, agents } = buildGrids(w, p);
      new Behaviour(w.agentCapacity).step(w, p, food, agents, new Rng(123));
      return { x: Array.from(w.x), y: Array.from(w.y), e: Array.from(w.energy), pop: w.population };
    };
    expect(run()).toEqual(run());
  });
});
