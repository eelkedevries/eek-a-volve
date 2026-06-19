import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { DEFAULT_PARAMETERS } from './params.ts';
import { SIZE, SPEED, METABOLIC_EFFICIENCY } from './genome.ts';
import {
  metabolicCost,
  feed,
  energyCapacity,
  metaboliseAndReap,
  MAX_AGE,
} from './energy.ts';

function spawnWith(world: World, size: number, speed: number, eff: number): number {
  const s = world.spawnAgent();
  world.traits[SIZE][s] = size;
  world.traits[SPEED][s] = speed;
  world.traits[METABOLIC_EFFICIENCY][s] = eff;
  return s;
}

describe('energy', () => {
  it('metabolic cost rises with size and speed, falls with efficiency', () => {
    const w = new World(4, 1);
    const cost = (size: number, speed: number, eff: number): number => {
      const s = spawnWith(w, size, speed, eff);
      const c = metabolicCost(w, s, DEFAULT_PARAMETERS);
      w.killAgent(s);
      return c;
    };
    const ref = cost(1, 1, 1);
    expect(cost(2, 1, 1)).toBeGreaterThan(ref);
    expect(cost(1, 2, 1)).toBeGreaterThan(ref);
    expect(cost(1, 1, 1.5)).toBeLessThan(ref);
  });

  it('feeding adds energy but never exceeds capacity', () => {
    const w = new World(1, 1);
    const s = spawnWith(w, 1, 1, 1);
    w.energy[s] = 0;
    feed(w, s, 30);
    expect(w.energy[s]).toBe(30);
    feed(w, s, 1000);
    expect(w.energy[s]).toBe(energyCapacity(1));
  });

  it('kills agents that run out of energy, draining and ageing the survivors', () => {
    const w = new World(2, 1);
    const a = spawnWith(w, 1, 1, 1);
    w.energy[a] = 0.01;
    const b = spawnWith(w, 1, 1, 1);
    w.energy[b] = 100;
    const deaths = metaboliseAndReap(w, DEFAULT_PARAMETERS);
    expect(deaths).toBe(1);
    expect(w.alive[a]).toBe(0);
    expect(w.alive[b]).toBe(1);
    expect(w.energy[b]).toBeLessThan(100);
    expect(w.age[b]).toBe(1);
  });

  it('kills agents that exceed the maximum age', () => {
    const w = new World(1, 1);
    const s = spawnWith(w, 1, 1, 1);
    w.energy[s] = 1e6;
    w.age[s] = MAX_AGE;
    const deaths = metaboliseAndReap(w, DEFAULT_PARAMETERS);
    expect(deaths).toBe(1);
    expect(w.alive[s]).toBe(0);
  });
});
