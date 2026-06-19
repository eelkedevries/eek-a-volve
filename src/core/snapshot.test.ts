import { describe, it, expect } from 'vitest';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS } from './params.ts';
import { TRAIT_COUNT, SIZE } from './genome.ts';
import {
  serialiseSnapshot,
  snapshotLength,
  HEADER_LENGTH,
  AGENT_STRIDE,
  H_TICK,
  H_POPULATION,
  H_BIRTHS,
  H_DEATHS,
  H_SPECIES_COUNT,
  H_TRAIT_MEANS,
} from './snapshot.ts';

function sim() {
  const s = createSimulation({
    ...DEFAULT_PARAMETERS,
    seed: 5,
    worldWidth: 200,
    worldHeight: 200,
    initialPopulation: 40,
    foodAbundance: 120,
  });
  s.run(25);
  return s;
}

describe('serialiseSnapshot', () => {
  it('sizes the buffer from header + stride * capacity', () => {
    expect(snapshotLength(10)).toBe(HEADER_LENGTH + AGENT_STRIDE * 10);
  });

  it('writes a header matching the simulation aggregates', () => {
    const s = sim();
    const out = new Float32Array(snapshotLength(s.world.agentCapacity));
    const count = serialiseSnapshot(s, out);
    expect(count).toBe(s.world.population);
    expect(out[H_TICK]).toBe(s.tick);
    expect(out[H_POPULATION]).toBe(s.world.population);
    expect(out[H_BIRTHS]).toBe(s.births);
    expect(out[H_DEATHS]).toBe(s.deaths);

    // Independent recomputation of means and species count.
    const w = s.world;
    const sums = new Float64Array(TRAIT_COUNT);
    const species = new Set<number>();
    let n = 0;
    for (let slot = 0; slot < w.agentCapacity; slot++) {
      if (!w.alive[slot]) continue;
      for (let t = 0; t < TRAIT_COUNT; t++) sums[t] += w.traits[t][slot];
      species.add(w.speciesId[slot]);
      n++;
    }
    expect(out[H_SPECIES_COUNT]).toBe(species.size);
    for (let t = 0; t < TRAIT_COUNT; t++) {
      expect(out[H_TRAIT_MEANS + t]).toBeCloseTo(sums[t] / n, 4);
    }
  });

  it('writes one record per live agent', () => {
    const s = sim();
    const out = new Float32Array(snapshotLength(s.world.agentCapacity));
    const count = serialiseSnapshot(s, out);
    // First record corresponds to the first live slot.
    const w = s.world;
    let first = -1;
    for (let slot = 0; slot < w.agentCapacity; slot++) if (w.alive[slot]) { first = slot; break; }
    expect(out[HEADER_LENGTH]).toBe(w.x[first]);
    expect(out[HEADER_LENGTH + 1]).toBe(w.y[first]);
    expect(out[HEADER_LENGTH + 2]).toBe(w.speciesId[first]);
    expect(out[HEADER_LENGTH + 3]).toBe(w.traits[SIZE][first]);
    // No record written past the live count.
    expect(count).toBeGreaterThan(0);
  });
});
