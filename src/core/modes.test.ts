import { describe, it, expect } from 'vitest';
import { createSimulation } from './loop.ts';
import {
  DEFAULT_PARAMETERS,
  COMMUNITY_PRESET,
  SWARM_PRESET,
  type SimulationParameters,
} from './params.ts';
import { MAX_POPULATION } from './bounds.ts';

/** Merge a mode preset onto the defaults, as the setup screen does. */
function withPreset(
  preset: Partial<SimulationParameters>,
  seed: number,
): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, ...preset, seed };
}

/** Run for `ticks` ticks, tracking the population extremes seen along the way. */
function populationBounds(
  params: SimulationParameters,
  ticks: number,
): { min: number; max: number; final: number } {
  const sim = createSimulation(params);
  let min = sim.world.population;
  let max = sim.world.population;
  for (let t = 0; t < ticks; t++) {
    sim.step();
    const pop = sim.world.population;
    if (pop < min) min = pop;
    if (pop > max) max = pop;
  }
  return { min, max, final: sim.world.population };
}

describe('view modes', () => {
  // A "short run" per the prompt: long enough to settle, short enough to be cheap.
  const TICKS = 1500;

  it('exposes a valid default mode and matching presets', () => {
    expect(DEFAULT_PARAMETERS.viewMode).toBe('community');
    expect(COMMUNITY_PRESET.viewMode).toBe('community');
    expect(SWARM_PRESET.viewMode).toBe('swarm');
  });

  it('produces finite, sane parameters when either preset is applied', () => {
    for (const preset of [COMMUNITY_PRESET, SWARM_PRESET]) {
      const params = withPreset(preset, 1);
      expect(Number.isFinite(params.worldWidth)).toBe(true);
      expect(Number.isFinite(params.worldHeight)).toBe(true);
      expect(params.initialPopulation).toBeGreaterThan(0);
      expect(params.initialPopulation).toBeLessThanOrEqual(MAX_POPULATION);
      expect(params.foodAbundance).toBeGreaterThan(0);
    }
  });

  it('keeps a community run within population bounds over a short run', () => {
    for (const seed of [1, 2, 3]) {
      const { min, max } = populationBounds(withPreset(COMMUNITY_PRESET, seed), TICKS);
      expect(min).toBeGreaterThan(0); // never extinct
      expect(max).toBeLessThanOrEqual(MAX_POPULATION); // cap respected
    }
  }, 30000);

  it('keeps a swarm run within population bounds over a short run', () => {
    for (const seed of [1, 2, 3]) {
      const { min, max } = populationBounds(withPreset(SWARM_PRESET, seed), TICKS);
      expect(min).toBeGreaterThan(0); // never extinct
      expect(max).toBeLessThanOrEqual(MAX_POPULATION); // cap respected
    }
  }, 30000);

  it('is deterministic per mode', () => {
    for (const preset of [COMMUNITY_PRESET, SWARM_PRESET]) {
      const params = withPreset(preset, 7);
      expect(populationBounds(params, 600)).toEqual(populationBounds(params, 600));
    }
  }, 30000);
});
