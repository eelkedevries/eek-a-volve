import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { Rng } from './rng.ts';
import { seedFood, regenerateFood, consumeFood } from './food.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, ...over };
}

describe('food', () => {
  it('seeds up to the carrying capacity and no further', () => {
    const w = new World(1, 1000);
    seedFood(w, params({ foodAbundance: 300 }), new Rng(1));
    expect(w.foodCount).toBe(300);
  });

  it('is bounded by the food pool when abundance exceeds it', () => {
    const w = new World(1, 50);
    seedFood(w, params({ foodAbundance: 300 }), new Rng(1));
    expect(w.foodCount).toBe(50);
  });

  it('regenerates at the configured rate, never beyond capacity', () => {
    const w = new World(1, 1000);
    const p = params({ foodAbundance: 20, foodRegenRate: 4 });
    const rng = new Rng(2);
    regenerateFood(w, p, rng);
    expect(w.foodCount).toBe(4);
    for (let i = 0; i < 100; i++) regenerateFood(w, p, rng);
    expect(w.foodCount).toBe(20);
  });

  it('frees a slot when food is consumed', () => {
    const w = new World(1, 1000);
    regenerateFood(w, params({ foodAbundance: 5, foodRegenRate: 5 }), new Rng(3));
    expect(w.foodCount).toBe(5);
    let slot = -1;
    for (let s = 0; s < w.foodCapacity; s++) {
      if (w.foodAlive[s]) {
        slot = s;
        break;
      }
    }
    consumeFood(w, slot);
    expect(w.foodCount).toBe(4);
    expect(w.foodAlive[slot]).toBe(0);
  });

  it('places food deterministically for a given seed', () => {
    const run = (): number[] => {
      const w = new World(1, 100);
      seedFood(w, params({ foodAbundance: 50 }), new Rng(99));
      return Array.from(w.foodX).concat(Array.from(w.foodY));
    };
    expect(run()).toEqual(run());
  });

  it('honours a fractional regeneration rate on average', () => {
    const w = new World(1, 100000);
    const p = params({ foodAbundance: 100000, foodRegenRate: 2.5 });
    const rng = new Rng(7);
    const ticks = 4000;
    for (let i = 0; i < ticks; i++) regenerateFood(w, p, rng);
    const perTick = w.foodCount / ticks;
    expect(perTick).toBeGreaterThan(2.3);
    expect(perTick).toBeLessThan(2.7);
  });
});
