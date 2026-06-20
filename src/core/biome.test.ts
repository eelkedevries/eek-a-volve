import { describe, it, expect } from 'vitest';
import { createSimulation } from './loop.ts';
import { World } from './world.ts';
import { Rng } from './rng.ts';
import { seedFood } from './food.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { fertilityAt } from './biome.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 400, worldHeight: 400, foodAbundance: 600, ...over };
}

describe('fertilityAt', () => {
  it('is deterministic and bounded in [0, 1]', () => {
    for (let i = 0; i < 200; i++) {
      const x = (i * 37) % 400;
      const y = (i * 53) % 400;
      const a = fertilityAt(x, y, 400, 400, 11);
      expect(a).toBe(fertilityAt(x, y, 400, 400, 11));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it('varies across space and with the seed', () => {
    const a = fertilityAt(20, 20, 400, 400, 1);
    const b = fertilityAt(380, 360, 400, 400, 1);
    expect(a).not.toBe(b); // spatial variation
    expect(fertilityAt(20, 20, 400, 400, 2)).not.toBe(a); // seed variation
  });

  it('has an approximately balanced spatial mean (~0.5)', () => {
    let sum = 0;
    let n = 0;
    for (let gy = 0; gy < 40; gy++) {
      for (let gx = 0; gx < 40; gx++) {
        sum += fertilityAt(gx * 10 + 5, gy * 10 + 5, 400, 400, 7);
        n++;
      }
    }
    expect(sum / n).toBeGreaterThan(0.4);
    expect(sum / n).toBeLessThan(0.6);
  });
});

describe('biome food placement', () => {
  /** Mean fertility at freshly seeded food, isolating placement from consumption. */
  function meanSeededFoodFertility(biomeStrength: number, seed: number): number {
    const p = params({ biomeStrength, seed });
    const w = new World(8, p.foodAbundance);
    seedFood(w, p, new Rng(seed));
    let sum = 0;
    let n = 0;
    for (let f = 0; f < w.foodCapacity; f++) {
      if (w.foodAlive[f] === 1) {
        sum += fertilityAt(w.foodX[f], w.foodY[f], p.worldWidth, p.worldHeight, p.seed);
        n++;
      }
    }
    return n > 0 ? sum / n : 0;
  }

  it('concentrates food in fertile regions when enabled, but not when off', () => {
    const off = meanSeededFoodFertility(0, 7);
    const on = meanSeededFoodFertility(1, 7);
    expect(off).toBeGreaterThan(0.45);
    expect(off).toBeLessThan(0.6); // uniform placement averages mid-fertility
    expect(on).toBeGreaterThan(off + 0.03); // biased clearly toward fertile ground
  });

  it('reproduces a run exactly with biomes enabled', () => {
    const p = params({ biomeStrength: 0.7, seed: 4 });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(200);
      return {
        population: sim.world.population,
        foodX: Array.from(sim.world.foodX),
        foodY: Array.from(sim.world.foodY),
      };
    };
    expect(run()).toEqual(run());
  });
});
