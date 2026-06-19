import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { TRAIT_COUNT } from './genome.ts';

describe('World pools', () => {
  it('allocates parallel columns of the right sizes', () => {
    const w = new World(10, 5);
    expect(w.traits.length).toBe(TRAIT_COUNT);
    expect(w.x.length).toBe(10);
    expect(w.foodX.length).toBe(5);
    expect(w.traits.every((col) => col.length === 10)).toBe(true);
  });

  it('spawns up to capacity, then returns -1', () => {
    const w = new World(3, 1);
    const slots = [w.spawnAgent(), w.spawnAgent(), w.spawnAgent()];
    expect(slots.every((s) => s >= 0)).toBe(true);
    expect(new Set(slots).size).toBe(3); // distinct slots
    expect(w.population).toBe(3);
    expect(w.spawnAgent()).toBe(-1);
    expect(w.population).toBe(3);
  });

  it('reuses a freed slot and keeps the count correct', () => {
    const w = new World(4, 1);
    const s0 = w.spawnAgent();
    const s1 = w.spawnAgent();
    expect(w.population).toBe(2);
    w.killAgent(s0);
    expect(w.alive[s0]).toBe(0);
    expect(w.population).toBe(1);
    const s2 = w.spawnAgent();
    expect(s2).toBe(s0); // the freed slot is reused
    expect(s2).not.toBe(s1);
    expect(w.population).toBe(2);
  });

  it('stays correct under churn without reallocating arrays', () => {
    const cap = 8;
    const w = new World(cap, cap);
    const xRef = w.x;
    const live: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const shouldSpawn = live.length === 0 || (live.length < cap && i % 2 === 0);
      if (shouldSpawn) {
        const s = w.spawnAgent();
        if (s >= 0) live.push(s);
      } else {
        w.killAgent(live.pop()!);
      }
      expect(w.population).toBe(live.length);
      expect(w.population).toBeLessThanOrEqual(cap);
    }
    expect(w.x).toBe(xRef); // never reallocated
  });

  it('mirrors the pool pattern for food', () => {
    const w = new World(1, 2);
    const f0 = w.spawnFood();
    const f1 = w.spawnFood();
    expect(w.foodCount).toBe(2);
    expect(w.spawnFood()).toBe(-1);
    w.killFood(f0);
    expect(w.foodCount).toBe(1);
    expect(w.spawnFood()).toBe(f0);
    expect(f1).not.toBe(f0);
  });
});
