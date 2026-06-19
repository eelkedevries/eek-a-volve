import { describe, it, expect } from 'vitest';
import {
  TRAITS,
  TRAIT_COUNT,
  TRAIT_RANGES,
  clampTrait,
  clampGenome,
} from './genome.ts';

describe('genome traits', () => {
  it('has a range for every trait, each with min < max', () => {
    expect(TRAIT_COUNT).toBe(TRAITS.length);
    expect(TRAIT_RANGES.length).toBe(TRAIT_COUNT);
    for (const r of TRAIT_RANGES) expect(r.min).toBeLessThan(r.max);
  });

  it('clampTrait maps out-of-range values back into range', () => {
    for (let i = 0; i < TRAIT_COUNT; i++) {
      const { min, max } = TRAIT_RANGES[i];
      expect(clampTrait(i, min - 1)).toBe(min);
      expect(clampTrait(i, max + 1)).toBe(max);
      const mid = (min + max) / 2;
      expect(clampTrait(i, mid)).toBe(mid);
    }
  });

  it('clampGenome clamps every trait in place', () => {
    const tooHigh = new Float32Array(TRAIT_COUNT).fill(1e9);
    clampGenome(tooHigh);
    for (let i = 0; i < TRAIT_COUNT; i++) expect(tooHigh[i]).toBe(TRAIT_RANGES[i].max);

    const tooLow = new Float32Array(TRAIT_COUNT).fill(-1e9);
    clampGenome(tooLow);
    for (let i = 0; i < TRAIT_COUNT; i++) expect(tooLow[i]).toBe(TRAIT_RANGES[i].min);
  });
});
