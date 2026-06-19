import { describe, it, expect } from 'vitest';
import { DEFAULT_PARAMETERS } from './params.ts';

describe('default parameters', () => {
  it('are all finite numbers where numeric', () => {
    for (const [key, value] of Object.entries(DEFAULT_PARAMETERS)) {
      if (typeof value === 'number') expect(Number.isFinite(value), key).toBe(true);
    }
  });

  it('are sanely positive and consistent', () => {
    const p = DEFAULT_PARAMETERS;
    expect(p.worldWidth).toBeGreaterThan(0);
    expect(p.worldHeight).toBeGreaterThan(0);
    expect(p.initialPopulation).toBeGreaterThan(0);
    expect(p.startingSpeciesCount).toBeGreaterThan(0);
    expect(p.foodAbundance).toBeGreaterThan(0);
    expect(p.reproductionThreshold).toBeGreaterThan(0);
    expect(p.maxTimeMultiplier).toBeGreaterThan(p.minTimeMultiplier);
  });
});
