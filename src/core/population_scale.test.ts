import { describe, it, expect } from 'vitest';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS } from './params.ts';

describe('configurable population ceiling', () => {
  it('sizes the world and grids from maxPopulation', () => {
    const sim = createSimulation({ ...DEFAULT_PARAMETERS, maxPopulation: 500 });
    expect(sim.world.agentCapacity).toBe(500);
  });

  it('keeps the default capacity at 2000', () => {
    expect(createSimulation({ ...DEFAULT_PARAMETERS }).world.agentCapacity).toBe(2000);
  });

  it('runs deterministically and stays within a higher ceiling', () => {
    const p = {
      ...DEFAULT_PARAMETERS,
      maxPopulation: 6000,
      initialPopulation: 1500,
      foodAbundance: 3000,
      seed: 3,
    };
    const run = (): number => {
      const s = createSimulation(p);
      s.run(150);
      return s.world.population;
    };
    const a = run();
    expect(a).toBe(run()); // deterministic
    expect(a).toBeLessThanOrEqual(6000); // within its own ceiling
  });
});
