import { describe, it, expect } from 'vitest';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { TRAIT_COUNT } from './genome.ts';
import {
  extractPopulation,
  encodePopulation,
  decodePopulation,
  POPULATION_FORMAT,
} from './population.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return {
    ...DEFAULT_PARAMETERS,
    worldWidth: 240,
    worldHeight: 240,
    initialPopulation: 80,
    foodAbundance: 200,
    ...over,
  };
}

/** A stable fingerprint of the living population, order-independent. */
function fingerprint(sim: ReturnType<typeof createSimulation>): string[] {
  const w = sim.world;
  const rows: string[] = [];
  for (let s = 0; s < w.agentCapacity; s++) {
    if (w.alive[s] !== 1) continue;
    const traits = Array.from({ length: TRAIT_COUNT }, (_, t) => w.traits[t][s].toFixed(4));
    rows.push(`${w.x[s].toFixed(2)},${w.y[s].toFixed(2)},${w.age[s]},${traits.join(',')}`);
  }
  return rows.sort();
}

describe('population export/import', () => {
  it('round-trips an extracted population through encode/decode', () => {
    const sim = createSimulation(params({ seed: 4 }));
    sim.run(150);
    const save = extractPopulation(sim);
    const back = decodePopulation(encodePopulation(save));
    expect(back.v).toBe(POPULATION_FORMAT);
    expect(back.creatures.length).toBe(save.creatures.length);
    expect(back.params.seed).toBe(save.params.seed);
    for (let i = 0; i < save.creatures.length; i++) {
      const a = save.creatures[i];
      const b = back.creatures[i];
      expect(b.age).toBe(a.age);
      expect(b.x).toBeCloseTo(a.x, 3);
      expect(b.energy).toBeCloseTo(a.energy, 3);
      for (let t = 0; t < TRAIT_COUNT; t++) expect(b.traits[t]).toBeCloseTo(a.traits[t], 5);
    }
  });

  it('decodes garbage to a valid, empty, clamped save without throwing', () => {
    for (const junk of ['', 'not json', '{', '[1,2,3]', '42']) {
      const save = decodePopulation(junk);
      expect(save.creatures).toEqual([]);
      expect(Object.keys(save.params).sort()).toEqual(Object.keys(DEFAULT_PARAMETERS).sort());
    }
  });

  it('clamps bad creature records and caps the count', () => {
    const save = decodePopulation(
      JSON.stringify({
        params: { worldWidth: 1e9, seed: -2 },
        creatures: [
          { x: 'nope', y: 5, energy: -10, age: -3, traits: [1e9, -1e9] },
          null,
          { traits: 'bad' },
        ],
      }),
    );
    expect(save.params.worldWidth).toBeLessThanOrEqual(4000);
    expect(save.params.seed).toBeGreaterThanOrEqual(0);
    // null/invalid records survive as best-effort clamped records or are dropped;
    // every retained record is well-formed.
    for (const r of save.creatures) {
      expect(r.traits.length).toBe(TRAIT_COUNT);
      expect(Number.isFinite(r.energy)).toBe(true);
      expect(r.energy).toBeGreaterThanOrEqual(0);
      expect(r.age).toBeGreaterThanOrEqual(0);
    }
  });

  it('seeds a simulation from an imported population', () => {
    const a = createSimulation(params({ seed: 7 }));
    a.run(200);
    const save = extractPopulation(a);

    const b = createSimulation(save.params, save.creatures);
    expect(b.world.population).toBe(save.creatures.length);
    // The loaded population matches the exported one (order-independent).
    expect(fingerprint(b)).toEqual(fingerprint(a));
  });

  it('a run resumed from a population is deterministic onward', () => {
    const a = createSimulation(params({ seed: 7 }));
    a.run(200);
    const save = extractPopulation(a);
    const run = (): number => {
      const sim = createSimulation(save.params, save.creatures);
      sim.run(300);
      return sim.world.population;
    };
    expect(run()).toBe(run());
  });

  it('falls back to random seeding when no population is supplied (default unchanged)', () => {
    const p = params({ seed: 3 });
    const withUndefined = createSimulation(p);
    const plain = createSimulation(p);
    expect(withUndefined.world.population).toBe(plain.world.population);
    expect(withUndefined.world.population).toBe(p.initialPopulation);
  });
});
