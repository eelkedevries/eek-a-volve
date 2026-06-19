import { describe, it, expect } from 'vitest';
import { TRAIT_RANGES, SIZE, SPEED } from '../core/genome.ts';
import { binomial } from './names.ts';

const mid = (): number[] => TRAIT_RANGES.map((r) => (r.min + r.max) / 2);

describe('binomial', () => {
  it('names a large, slow lineage as a rotund, sluggish thing', () => {
    const means = mid();
    means[SIZE] = TRAIT_RANGES[SIZE].max;
    means[SPEED] = TRAIT_RANGES[SPEED].min;
    const name = binomial(means);
    expect(name).toContain('Rotundus');
    expect(name.toLowerCase()).toContain('lentus');
  });

  it('is deterministic for a given trait profile', () => {
    const means = mid();
    means[SIZE] = TRAIT_RANGES[SIZE].max;
    expect(binomial(means)).toBe(binomial(means));
  });

  it('gives distinct profiles distinct names', () => {
    const big = mid();
    big[SIZE] = TRAIT_RANGES[SIZE].max;
    const small = mid();
    small[SIZE] = TRAIT_RANGES[SIZE].min;
    expect(binomial(big)).not.toBe(binomial(small));
  });

  it('reads as a two-part Genus species', () => {
    const name = binomial(mid().map((v, t) => v + (t % 2 === 0 ? 0.3 : -0.2)));
    const parts = name.split(' ');
    expect(parts.length).toBe(2);
    expect(parts[0][0]).toBe(parts[0][0].toUpperCase());
    expect(parts[1][0]).toBe(parts[1][0].toLowerCase());
  });
});
