import { describe, it, expect } from 'vitest';
import { Rng } from './rng.ts';
import { World } from './world.ts';
import { DEFAULT_PARAMETERS } from './params.ts';
import { TRAIT_COUNT, TRAIT_RANGES } from './genome.ts';
import { breed, FREAK_MUTATION_RATE } from './mutation.ts';

const MID = TRAIT_RANGES.map((r) => (r.min + r.max) / 2);

function setup(): { world: World; parent: number; child: number } {
  const world = new World(2, 1);
  const parent = world.spawnAgent();
  const child = world.spawnAgent();
  for (let t = 0; t < TRAIT_COUNT; t++) world.traits[t][parent] = MID[t];
  return { world, parent, child };
}

function childGenome(world: World, child: number): number[] {
  return Array.from({ length: TRAIT_COUNT }, (_, t) => world.traits[t][child]);
}

describe('breed', () => {
  it('is deterministic for a given seed and parent', () => {
    const params = { ...DEFAULT_PARAMETERS, mutationRate: 0.5, mutationMagnitude: 0.2 };
    const run = () => {
      const { world, parent, child } = setup();
      const freak = breed(world, child, parent, params, new Rng(123));
      return { genome: childGenome(world, child), freak };
    };
    expect(run()).toEqual(run());
  });

  it('keeps every trait in range even under huge mutation', () => {
    const params = { ...DEFAULT_PARAMETERS, mutationRate: 1, mutationMagnitude: 100 };
    const { world, parent, child } = setup();
    breed(world, child, parent, params, new Rng(7));
    for (let t = 0; t < TRAIT_COUNT; t++) {
      expect(world.traits[t][child]).toBeGreaterThanOrEqual(TRAIT_RANGES[t].min);
      expect(world.traits[t][child]).toBeLessThanOrEqual(TRAIT_RANGES[t].max);
    }
  });

  it('changes traits when the mutation rate is 1', () => {
    const params = { ...DEFAULT_PARAMETERS, mutationRate: 1, mutationMagnitude: 0.1 };
    const { world, parent, child } = setup();
    breed(world, child, parent, params, new Rng(5));
    let changed = 0;
    for (let t = 0; t < TRAIT_COUNT; t++) if (world.traits[t][child] !== MID[t]) changed++;
    expect(changed).toBeGreaterThan(0);
  });

  it('copies the parent exactly when rate is 0 and no freak fires', () => {
    const params = { ...DEFAULT_PARAMETERS, mutationRate: 0 };
    const { world, parent, child } = setup();
    const rng = new Rng(1);
    let nonFreakChecks = 0;
    for (let i = 0; i < 2000; i++) {
      const freak = breed(world, child, parent, params, rng);
      if (!freak) {
        for (let t = 0; t < TRAIT_COUNT; t++) expect(world.traits[t][child]).toBe(MID[t]);
        nonFreakChecks++;
      }
    }
    expect(nonFreakChecks).toBeGreaterThan(0);
  });

  it('triggers freak mutations near the configured rate', () => {
    const params = { ...DEFAULT_PARAMETERS, mutationRate: 0 };
    const { world, parent, child } = setup();
    const rng = new Rng(42);
    const n = 100000;
    let freaks = 0;
    for (let i = 0; i < n; i++) if (breed(world, child, parent, params, rng)) freaks++;
    expect(freaks / n).toBeCloseTo(FREAK_MUTATION_RATE, 3);
  });
});
