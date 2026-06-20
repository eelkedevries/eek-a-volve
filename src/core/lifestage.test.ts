import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, SPEED, SENSE_RADIUS, DIET } from './genome.ts';
import { Behaviour } from './behaviour.ts';
import {
  stageOf,
  isMature,
  JUVENILE,
  ADULT,
  ELDER,
  JUVENILE_MAX_AGE,
  ELDER_MIN_AGE,
} from './lifestage.ts';

describe('life stages', () => {
  it('maps age to the right stage at the boundaries', () => {
    expect(stageOf(0)).toBe(JUVENILE);
    expect(stageOf(JUVENILE_MAX_AGE - 1)).toBe(JUVENILE);
    expect(stageOf(JUVENILE_MAX_AGE)).toBe(ADULT);
    expect(stageOf(ELDER_MIN_AGE - 1)).toBe(ADULT);
    expect(stageOf(ELDER_MIN_AGE)).toBe(ELDER);
  });

  it('treats only mature creatures as fertile', () => {
    expect(isMature(JUVENILE_MAX_AGE - 1)).toBe(false);
    expect(isMature(JUVENILE_MAX_AGE)).toBe(true);
    expect(isMature(ELDER_MIN_AGE)).toBe(true);
  });

  it('lets adults reproduce but not juveniles', () => {
    const p: SimulationParameters = {
      ...DEFAULT_PARAMETERS,
      worldWidth: 200,
      worldHeight: 200,
      reproductionThreshold: 50,
      mutationRate: 0,
    };
    const make = (age: number): World => {
      const w = new World(8, 1);
      const a = w.spawnAgent();
      w.x[a] = 50; w.y[a] = 50; w.energy[a] = 100; w.age[a] = age;
      w.traits[SIZE][a] = 1; w.traits[SPEED][a] = 0; w.traits[SENSE_RADIUS][a] = 10; w.traits[DIET][a] = 0;
      return w;
    };
    const grids = (w: World): { food: SpatialGrid; agents: SpatialGrid } => {
      const agents = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.agentCapacity);
      agents.rebuildFromAgents(w);
      const food = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.foodCapacity);
      return { food, agents };
    };

    const juvenile = make(10);
    const gj = grids(juvenile);
    expect(new Behaviour(juvenile.agentCapacity).step(juvenile, p, gj.food, gj.agents, new Rng(1))).toBe(0);

    const adult = make(JUVENILE_MAX_AGE + 10);
    const ga = grids(adult);
    expect(new Behaviour(adult.agentCapacity).step(adult, p, ga.food, ga.agents, new Rng(1))).toBe(1);
  });
});
