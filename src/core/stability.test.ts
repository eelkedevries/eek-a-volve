import { describe, it, expect } from 'vitest';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { MAX_POPULATION, NEAR_EXTINCTION_THRESHOLD } from './bounds.ts';

/** Run for `ticks` ticks, tracking the population extremes seen along the way. */
function populationBounds(
  params: SimulationParameters,
  ticks: number,
): { min: number; max: number; final: number } {
  const sim = createSimulation(params);
  let min = Infinity;
  let max = 0;
  for (let t = 0; t < ticks; t++) {
    sim.step();
    const pop = sim.world.population;
    if (pop < min) min = pop;
    if (pop > max) max = pop;
  }
  return { min, max, final: sim.world.population };
}

describe('population stability', () => {
  const TICKS = 6000;

  it('neither goes extinct nor explodes under default parameters', () => {
    for (const seed of [1, 2, 3]) {
      const { min, max } = populationBounds({ ...DEFAULT_PARAMETERS, seed }, TICKS);
      // No extinction: stays well clear of the near-extinction floor.
      expect(min).toBeGreaterThan(NEAR_EXTINCTION_THRESHOLD);
      expect(min).toBeGreaterThan(50);
      // No unbounded growth: held by the food carrying capacity, far under the ceiling.
      expect(max).toBeLessThan(1000);
      expect(max).toBeLessThan(MAX_POPULATION);
    }
  });

  it('is deterministic over a long run', () => {
    const params = { ...DEFAULT_PARAMETERS, seed: 9 };
    expect(populationBounds(params, 1500)).toEqual(populationBounds(params, 1500));
  });
});
