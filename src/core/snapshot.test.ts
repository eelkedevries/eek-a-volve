import { describe, it, expect } from 'vitest';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS } from './params.ts';
import { TRAIT_COUNT, SIZE } from './genome.ts';
import {
  serialiseSnapshot,
  snapshotLength,
  foodOffset,
  packState,
  unpackAction,
  unpackStage,
  HEADER_LENGTH,
  AGENT_STRIDE,
  FOOD_STRIDE,
  A_X,
  A_Y,
  A_HEADING,
  A_STATE,
  A_ID,
  A_ENERGY,
  FOOD_X,
  FOOD_TYPE,
  H_TICK,
  H_POPULATION,
  H_SPECIES_COUNT,
  H_TRAIT_MEANS,
  H_FOOD_COUNT,
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

describe('snapshot format', () => {
  it('sizes the buffer from header + agents + food', () => {
    expect(snapshotLength(10, 5)).toBe(HEADER_LENGTH + AGENT_STRIDE * 10 + FOOD_STRIDE * 5);
  });

  it('packs and unpacks stage and action without clashing', () => {
    for (let stage = 0; stage < 3; stage++) {
      for (let action = 0; action < 6; action++) {
        const code = packState(stage, action);
        expect(unpackAction(code)).toBe(action);
        expect(unpackStage(code)).toBe(stage);
      }
    }
  });

  it('writes a header matching the simulation, including food count', () => {
    const s = sim();
    const out = new Float32Array(snapshotLength(s.world.agentCapacity, s.world.foodCapacity));
    const count = serialiseSnapshot(s, out);
    expect(count).toBe(s.world.population);
    expect(out[H_TICK]).toBe(s.tick);
    expect(out[H_POPULATION]).toBe(s.world.population);
    expect(out[H_FOOD_COUNT]).toBe(s.world.foodCount);
    expect(out[H_SPECIES_COUNT]).toBeGreaterThan(0);
  });

  it('writes per-agent heading, state, id, and energy for the first live agent', () => {
    const s = sim();
    const w = s.world;
    const out = new Float32Array(snapshotLength(w.agentCapacity, w.foodCapacity));
    serialiseSnapshot(s, out);
    let first = -1;
    for (let slot = 0; slot < w.agentCapacity; slot++) if (w.alive[slot]) { first = slot; break; }
    const o = HEADER_LENGTH; // first record
    expect(out[o + A_X]).toBe(w.x[first]);
    expect(out[o + A_Y]).toBe(w.y[first]);
    expect(out[o + A_ID]).toBe(w.id[first]);
    expect(out[o + A_HEADING]).toBeCloseTo(Math.atan2(w.vy[first], w.vx[first]), 5);
    expect(unpackAction(out[o + A_STATE])).toBe(w.action[first]);
    expect(out[o + A_ENERGY]).toBeGreaterThanOrEqual(0);
    expect(out[o + A_ENERGY]).toBeLessThanOrEqual(1.0001);
  });

  it('appends a food block after the live agents', () => {
    const s = sim();
    const w = s.world;
    const out = new Float32Array(snapshotLength(w.agentCapacity, w.foodCapacity));
    serialiseSnapshot(s, out);
    const base = foodOffset(w.population);
    expect(out[H_FOOD_COUNT]).toBe(w.foodCount);
    // first food record is a real position within the world, type 0 (plant)
    if (w.foodCount > 0) {
      expect(out[base + FOOD_X]).toBeGreaterThanOrEqual(0);
      expect(out[base + FOOD_TYPE]).toBe(0);
    }
  });

  it('keeps existing header offsets (trait means) intact for older consumers', () => {
    const s = sim();
    const w = s.world;
    const out = new Float32Array(snapshotLength(w.agentCapacity, w.foodCapacity));
    serialiseSnapshot(s, out);
    const sums = new Float64Array(TRAIT_COUNT);
    let n = 0;
    for (let slot = 0; slot < w.agentCapacity; slot++) {
      if (!w.alive[slot]) continue;
      for (let t = 0; t < TRAIT_COUNT; t++) sums[t] += w.traits[t][slot];
      n++;
    }
    for (let t = 0; t < TRAIT_COUNT; t++) expect(out[H_TRAIT_MEANS + t]).toBeCloseTo(sums[t] / n, 4);
    expect(out[HEADER_LENGTH + 3]).toBe(w.traits[SIZE][firstLive(w)]); // A_SCALE still = size
  });
});

function firstLive(w: { alive: Uint8Array; agentCapacity: number }): number {
  for (let s = 0; s < w.agentCapacity; s++) if (w.alive[s]) return s;
  return -1;
}
