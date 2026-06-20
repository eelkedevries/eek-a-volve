import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, SPEED, SENSE_RADIUS, DIET } from './genome.ts';
import { Behaviour } from './behaviour.ts';
import { Predation } from './predation.ts';
import { IDLE, SEEKING, EATING, FLEEING, HUNTING } from './state.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 200, worldHeight: 200, ...over };
}

function grids(w: World, p: SimulationParameters): { food: SpatialGrid; agents: SpatialGrid } {
  const agents = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.agentCapacity);
  agents.rebuildFromAgents(w);
  const food = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.foodCapacity);
  for (let s = 0; s < w.foodCapacity; s++) if (w.foodAlive[s]) food.insert(s, w.foodX[s], w.foodY[s]);
  return { food, agents };
}

describe('agent identity and lineage', () => {
  it('assigns unique, monotonic ids; a reused slot gets a new id', () => {
    const w = new World(4, 1);
    const a = w.spawnAgent();
    const b = w.spawnAgent();
    expect(w.id[a]).not.toBe(w.id[b]);
    expect(w.id[b]).toBeGreaterThan(w.id[a]);
    const idA = w.id[a];
    w.killAgent(a);
    const c = w.spawnAgent();
    expect(c).toBe(a); // reused slot
    expect(w.id[c]).toBeGreaterThan(idA); // but a fresh id
  });

  it('zeroes lineage and action on spawn', () => {
    const w = new World(2, 1);
    const s = w.spawnAgent();
    expect(w.generation[s]).toBe(0);
    expect(w.offspringCount[s]).toBe(0);
    expect(w.action[s]).toBe(IDLE);
  });

  it('tracks generation and offspring count on reproduction', () => {
    const p = params({ reproductionThreshold: 50, mutationRate: 0 });
    const w = new World(8, 1);
    const a = w.spawnAgent();
    w.x[a] = 50; w.y[a] = 50; w.energy[a] = 100;
    w.traits[SIZE][a] = 1; w.traits[SPEED][a] = 0; w.traits[SENSE_RADIUS][a] = 10; w.traits[DIET][a] = 0;
    const g = grids(w, p);
    new Behaviour(w.agentCapacity).step(w, p, g.food, g.agents, new Rng(1));
    expect(w.offspringCount[a]).toBe(1);
    let child = -1;
    for (let s = 0; s < w.agentCapacity; s++) if (w.alive[s] && s !== a) child = s;
    expect(w.generation[child]).toBe(1);
  });
});

describe('action recording', () => {
  function loner(speed: number, sense: number): { w: World; a: number } {
    const w = new World(4, 4);
    const a = w.spawnAgent();
    w.x[a] = 100; w.y[a] = 100; w.energy[a] = 20;
    w.traits[SIZE][a] = 1; w.traits[SPEED][a] = speed; w.traits[SENSE_RADIUS][a] = sense; w.traits[DIET][a] = 0;
    return { w, a };
  }

  it('records EATING on reaching food', () => {
    const p = params({ reproductionThreshold: 1e9 });
    const { w, a } = loner(5, 50);
    const f = w.spawnFood();
    w.foodX[f] = 103; w.foodY[f] = 100;
    const g = grids(w, p);
    new Behaviour(w.agentCapacity).step(w, p, g.food, g.agents, new Rng(1));
    expect(w.action[a]).toBe(EATING);
  });

  it('records SEEKING for distant food and IDLE when alone', () => {
    const p = params({ reproductionThreshold: 1e9 });
    const seek = loner(1, 50);
    const f = seek.w.spawnFood();
    seek.w.foodX[f] = 140; seek.w.foodY[f] = 100;
    const gs = grids(seek.w, p);
    new Behaviour(seek.w.agentCapacity).step(seek.w, p, gs.food, gs.agents, new Rng(1));
    expect(seek.w.action[seek.a]).toBe(SEEKING);

    const alone = loner(1, 10);
    const ga = grids(alone.w, p);
    new Behaviour(alone.w.agentCapacity).step(alone.w, p, ga.food, ga.agents, new Rng(1));
    expect(alone.w.action[alone.a]).toBe(IDLE);
  });

  it('records FLEEING from a larger carnivore', () => {
    const p = params({ reproductionThreshold: 1e9 });
    const w = new World(4, 1);
    const prey = w.spawnAgent();
    w.x[prey] = 100; w.y[prey] = 100;
    w.traits[SIZE][prey] = 1; w.traits[SPEED][prey] = 3; w.traits[SENSE_RADIUS][prey] = 50; w.traits[DIET][prey] = 0.2;
    const pred = w.spawnAgent();
    w.x[pred] = 110; w.y[pred] = 100;
    w.traits[SIZE][pred] = 2; w.traits[SPEED][pred] = 0; w.traits[SENSE_RADIUS][pred] = 50; w.traits[DIET][pred] = 0.9;
    const g = grids(w, p);
    new Behaviour(w.agentCapacity).step(w, p, g.food, g.agents, new Rng(1));
    expect(w.action[prey]).toBe(FLEEING);
  });

  it('records HUNTING on a successful predator', () => {
    const p = params();
    const w = new World(8, 1);
    const pred = w.spawnAgent();
    w.x[pred] = 50; w.y[pred] = 50; w.energy[pred] = 10;
    w.traits[SIZE][pred] = 2; w.traits[DIET][pred] = 0.9;
    const prey = w.spawnAgent();
    w.x[prey] = 52; w.y[prey] = 50; w.energy[prey] = 10;
    w.traits[SIZE][prey] = 0.5; w.traits[DIET][prey] = 0.1;
    const grid = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.agentCapacity);
    grid.rebuildFromAgents(w);
    new Predation().step(w, { ...p, predation: true }, grid);
    expect(w.action[pred]).toBe(HUNTING);
  });
});
