import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { Rng } from './rng.ts';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { regenerateFood, seasonalFactor } from './food.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 200, worldHeight: 200, ...over };
}

describe('seasonalFactor', () => {
  it('is exactly 1 when the season is off', () => {
    expect(seasonalFactor(0, params({ seasonAmplitude: 0 }))).toBe(1);
    expect(seasonalFactor(500, params({ seasonAmplitude: 0 }))).toBe(1);
  });

  it('swings smoothly and stays non-negative', () => {
    const p = params({ seasonAmplitude: 0.9, seasonPeriod: 8 });
    expect(seasonalFactor(0, p)).toBeCloseTo(1, 6); // sin 0
    expect(seasonalFactor(2, p)).toBeCloseTo(1.9, 6); // peak (sin +1)
    expect(seasonalFactor(6, p)).toBeCloseTo(0.1, 6); // trough (sin -1)
  });

  it('clamps to zero rather than going negative for a large amplitude', () => {
    const p = params({ seasonAmplitude: 2, seasonPeriod: 8 });
    expect(seasonalFactor(6, p)).toBe(0); // 1 + 2*(-1) = -1 → clamped
  });
});

describe('seasonal food regeneration', () => {
  it('regenerates more in peak season than in the trough', () => {
    const p = params({ seasonAmplitude: 0.9, seasonPeriod: 8, foodRegenRate: 12, foodAbundance: 500 });
    const added = (tick: number): number => {
      const w = new World(1, 600); // plantCount starts at 0, well under capacity
      regenerateFood(w, p, new Rng(1), tick);
      return w.plantCount;
    };
    expect(added(2)).toBeGreaterThan(added(6)); // peak vs trough
  });

  it('reproduces a run exactly with seasons enabled', () => {
    const p = params({
      seasonAmplitude: 0.7,
      seasonPeriod: 300,
      initialPopulation: 60,
      foodAbundance: 200,
      seed: 5,
    });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(400);
      return { population: sim.world.population, food: sim.world.foodCount };
    };
    expect(run()).toEqual(run());
  });

  it('a population tracks the seasonal carrying capacity (food oscillates)', () => {
    const p = params({
      seasonAmplitude: 0.85,
      seasonPeriod: 240,
      worldWidth: 300,
      worldHeight: 300,
      initialPopulation: 120,
      foodAbundance: 300,
      seed: 2,
    });
    const sim = createSimulation(p);
    let minFood = Infinity;
    let maxFood = 0;
    for (let t = 0; t < 1200; t++) {
      sim.step();
      if (t > 240) {
        // ignore the initial settle
        minFood = Math.min(minFood, sim.world.foodCount);
        maxFood = Math.max(maxFood, sim.world.foodCount);
      }
    }
    expect(maxFood - minFood).toBeGreaterThan(20); // clear seasonal swing in food level
  });
});
