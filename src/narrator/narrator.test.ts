import { describe, it, expect } from 'vitest';
import { TRAIT_RANGES } from '../core/genome.ts';
import { summarise, type NarratorStats } from './summary.ts';
import { templatedLine } from './templates.ts';

const means = TRAIT_RANGES.map((r) => (r.min + r.max) / 2);

function stats(over: Partial<NarratorStats> = {}): NarratorStats {
  return {
    tick: 100,
    population: 250,
    births: 5,
    deaths: 3,
    speciesCount: 4,
    traitMeans: means,
    ...over,
  };
}

describe('narrator summary', () => {
  it('includes only the supplied figures', () => {
    const s = summarise(stats());
    expect(s).toContain('100');
    expect(s).toContain('250');
    expect(s).toContain('4');
    expect(s).toContain('5');
    expect(s).toContain('3');
  });

  it('appends a milestone when present', () => {
    expect(summarise(stats({ milestone: 'A meteor strikes!' }))).toContain('meteor');
  });

  it('notes ornamentation only when sexual selection is active', () => {
    expect(summarise(stats({ sexual: true, ornament: 0.8 }))).toContain('Courtship');
    expect(summarise(stats({ sexual: true, ornament: 0.8 }))).toContain('flamboyantly');
    expect(summarise(stats())).not.toContain('Courtship'); // omitted when not supplied
    expect(summarise(stats({ ornament: 0.8 }))).not.toContain('Courtship'); // needs sexual flag
  });

  it('notes the environment only when biomes/pheromones are active', () => {
    expect(summarise(stats({ biomes: true }))).toContain('biome');
    expect(summarise(stats({ pheromones: true }))).toContain('scent');
    expect(summarise(stats())).not.toContain('They cross');
  });
});

describe('templated fallback', () => {
  it('celebrates a growing population with its real figures', () => {
    expect(templatedLine(stats({ births: 10, deaths: 2 }))).toContain('10');
  });

  it('laments a shrinking population', () => {
    expect(templatedLine(stats({ births: 1, deaths: 9 }))).toContain('9');
  });

  it('marks extinction', () => {
    expect(templatedLine(stats({ population: 0 }))).toContain('silent');
  });

  it('prefers an explicit milestone', () => {
    expect(templatedLine(stats({ milestone: 'A new lineage!' }))).toBe('A new lineage!');
  });
});
