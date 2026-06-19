import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { Rng } from './rng.ts';
import { TRAIT_COUNT, TRAIT_RANGES } from './genome.ts';
import {
  isNearExtinction,
  spawnRandomAgent,
  immigrate,
  NEAR_EXTINCTION_THRESHOLD,
} from './bounds.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 100, worldHeight: 100, ...over };
}

describe('population bounds', () => {
  it('flags near-extinction only for a small positive population', () => {
    const w = new World(100, 1);
    expect(isNearExtinction(w)).toBe(false); // empty
    for (let i = 0; i < NEAR_EXTINCTION_THRESHOLD; i++) w.spawnAgent();
    expect(isNearExtinction(w)).toBe(true); // at the threshold
    w.spawnAgent();
    expect(isNearExtinction(w)).toBe(false); // above it
  });

  it('spawns a fresh-genome agent within trait ranges', () => {
    const w = new World(4, 1);
    const s = spawnRandomAgent(w, params({ startingEnergy: 42 }), new Rng(1), 3);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(w.speciesId[s]).toBe(3);
    expect(w.energy[s]).toBe(42);
    for (let t = 0; t < TRAIT_COUNT; t++) {
      expect(w.traits[t][s]).toBeGreaterThanOrEqual(TRAIT_RANGES[t].min);
      expect(w.traits[t][s]).toBeLessThanOrEqual(TRAIT_RANGES[t].max);
    }
    expect(w.x[s]).toBeGreaterThanOrEqual(0);
    expect(w.x[s]).toBeLessThan(100);
  });

  it('adds no immigrants when immigration is disabled', () => {
    const w = new World(100, 1);
    const p = params({ immigration: false });
    const rng = new Rng(1);
    let total = 0;
    for (let i = 0; i < 100; i++) total += immigrate(w, p, rng);
    expect(total).toBe(0);
    expect(w.population).toBe(0);
  });

  it('trickles immigrants near the configured rate when enabled', () => {
    const w = new World(100000, 1);
    const p = params({ immigration: true });
    const rng = new Rng(5);
    const ticks = 5000;
    let total = 0;
    for (let i = 0; i < ticks; i++) total += immigrate(w, p, rng);
    const perTick = total / ticks;
    expect(perTick).toBeGreaterThan(0.15);
    expect(perTick).toBeLessThan(0.25);
    expect(w.population).toBe(total);
  });

  it('never exceeds the agent capacity (hard ceiling)', () => {
    const w = new World(3, 1);
    const p = params({ immigration: true });
    const rng = new Rng(2);
    for (let i = 0; i < 1000; i++) immigrate(w, p, rng);
    expect(w.population).toBeLessThanOrEqual(3);
  });

  it('immigrates deterministically for a given seed', () => {
    const run = (): unknown => {
      const w = new World(1000, 1);
      const rng = new Rng(123);
      for (let i = 0; i < 50; i++) immigrate(w, params({ immigration: true }), rng);
      return { pop: w.population, x: Array.from(w.x), y: Array.from(w.y) };
    };
    expect(run()).toEqual(run());
  });
});
