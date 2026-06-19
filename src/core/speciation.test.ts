import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { Rng } from './rng.ts';
import { TRAIT_COUNT, TRAIT_RANGES } from './genome.ts';
import { Speciation } from './speciation.ts';

function setTraits(world: World, slot: number, values: number[]): void {
  for (let t = 0; t < TRAIT_COUNT; t++) world.traits[t][slot] = values[t];
}

describe('Speciation', () => {
  it('separates distant trait groups into distinct species', () => {
    const w = new World(12, 1);
    const low = TRAIT_RANGES.map((r) => r.min);
    const high = TRAIT_RANGES.map((r) => r.max);
    const groupA: number[] = [];
    const groupB: number[] = [];
    for (let i = 0; i < 5; i++) {
      const s = w.spawnAgent();
      setTraits(w, s, low);
      groupA.push(s);
    }
    for (let i = 0; i < 5; i++) {
      const s = w.spawnAgent();
      setTraits(w, s, high);
      groupB.push(s);
    }
    const count = new Speciation().cluster(w);
    expect(count).toBe(2);
    const idA = w.speciesId[groupA[0]];
    const idB = w.speciesId[groupB[0]];
    expect(idA).not.toBe(idB);
    for (const s of groupA) expect(w.speciesId[s]).toBe(idA);
    for (const s of groupB) expect(w.speciesId[s]).toBe(idB);
  });

  it('groups near-identical agents into one species', () => {
    const w = new World(10, 1);
    const mid = TRAIT_RANGES.map((r) => (r.min + r.max) / 2);
    for (let i = 0; i < 8; i++) {
      const s = w.spawnAgent();
      setTraits(w, s, mid.map((v) => v + i * 0.0001));
    }
    expect(new Speciation().cluster(w)).toBe(1);
  });

  it('is deterministic for a given population', () => {
    const make = (): number[] => {
      const w = new World(20, 1);
      const rng = new Rng(3);
      for (let i = 0; i < 15; i++) {
        const s = w.spawnAgent();
        for (let t = 0; t < TRAIT_COUNT; t++) {
          const r = TRAIT_RANGES[t];
          w.traits[t][s] = r.min + rng.next() * (r.max - r.min);
        }
      }
      new Speciation().cluster(w);
      return Array.from(w.speciesId);
    };
    expect(make()).toEqual(make());
  });
});
