import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, SPEED, SENSE_RADIUS, DIET, METABOLIC_EFFICIENCY } from './genome.ts';
import {
  dropCarrion,
  decayCarrion,
  CARRION,
  PLANT,
  CARRION_LIFETIME,
  CARRION_ENERGY_PER_SIZE,
  CARRION_RESERVE,
} from './food.ts';
import { metaboliseAndReap } from './energy.ts';
import { Predation } from './predation.ts';
import { Behaviour } from './behaviour.ts';

describe('carrion', () => {
  it('drops size-scaled carrion when an agent starves', () => {
    const w = new World(2, 50);
    const a = w.spawnAgent();
    w.x[a] = 10; w.y[a] = 20; w.energy[a] = 0.01;
    w.traits[SIZE][a] = 2; w.traits[SPEED][a] = 1; w.traits[METABOLIC_EFFICIENCY][a] = 1;
    metaboliseAndReap(w, DEFAULT_PARAMETERS);
    expect(w.alive[a]).toBe(0);
    expect(w.carrionCount).toBe(1);
    let c = -1;
    for (let f = 0; f < w.foodCapacity; f++) if (w.foodAlive[f] && w.foodType[f] === CARRION) c = f;
    expect(w.foodX[c]).toBe(10);
    expect(w.foodY[c]).toBe(20);
    expect(w.foodEnergy[c]).toBeCloseTo(2 * CARRION_ENERGY_PER_SIZE);
  });

  it('carrion rots away after its lifetime', () => {
    const w = new World(1, 10);
    dropCarrion(w, 5, 5, 1);
    expect(w.carrionCount).toBe(1);
    for (let t = 0; t < CARRION_LIFETIME; t++) decayCarrion(w);
    expect(w.carrionCount).toBe(0);
  });

  it('does not drop carrion on a predation kill', () => {
    const w = new World(8, 10);
    const pred = w.spawnAgent();
    w.x[pred] = 50; w.y[pred] = 50; w.energy[pred] = 10;
    w.traits[SIZE][pred] = 2; w.traits[DIET][pred] = 0.9;
    const prey = w.spawnAgent();
    w.x[prey] = 52; w.y[prey] = 50; w.energy[prey] = 10;
    w.traits[SIZE][prey] = 0.5; w.traits[DIET][prey] = 0.1;
    const grid = new SpatialGrid(100, 100, 32, w.agentCapacity);
    grid.rebuildFromAgents(w);
    new Predation().step(w, { ...DEFAULT_PARAMETERS, predation: true }, grid);
    expect(w.alive[prey]).toBe(0);
    expect(w.carrionCount).toBe(0);
  });

  it('biases feeding by diet: carnivores to carrion, herbivores to plants', () => {
    const p: SimulationParameters = {
      ...DEFAULT_PARAMETERS,
      worldWidth: 200,
      worldHeight: 200,
      reproductionThreshold: 1e9,
    };
    const run = (diet: number): { ateCarrion: boolean; atePlant: boolean } => {
      const w = new World(4, 10);
      const a = w.spawnAgent();
      w.x[a] = 100; w.y[a] = 100; w.energy[a] = 20;
      w.traits[SIZE][a] = 1; w.traits[SPEED][a] = 10; w.traits[SENSE_RADIUS][a] = 50; w.traits[DIET][a] = diet;
      const plant = w.spawnFood();
      w.foodX[plant] = 90; w.foodY[plant] = 100; w.foodType[plant] = PLANT; w.foodEnergy[plant] = 25;
      const carr = w.spawnFood();
      w.foodX[carr] = 110; w.foodY[carr] = 100; w.foodType[carr] = CARRION; w.foodEnergy[carr] = 40;
      const agents = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.agentCapacity);
      agents.rebuildFromAgents(w);
      const food = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.foodCapacity);
      food.insert(plant, 90, 100);
      food.insert(carr, 110, 100);
      new Behaviour(w.agentCapacity).step(w, p, food, agents, new Rng(1));
      return { ateCarrion: w.foodAlive[carr] === 0, atePlant: w.foodAlive[plant] === 0 };
    };
    expect(run(0.9).ateCarrion).toBe(true);
    expect(run(0.1).atePlant).toBe(true);
  });

  it('never exceeds the carrion reserve', () => {
    const w = new World(1, CARRION_RESERVE + 50);
    for (let i = 0; i < CARRION_RESERVE + 100; i++) dropCarrion(w, 1, 1, 1);
    expect(w.carrionCount).toBeLessThanOrEqual(CARRION_RESERVE);
  });
});
