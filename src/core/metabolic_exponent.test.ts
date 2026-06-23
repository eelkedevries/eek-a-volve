import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { metabolicCost } from './energy.ts';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, SPEED, METABOLIC_EFFICIENCY } from './genome.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return {
    ...DEFAULT_PARAMETERS,
    worldWidth: 320,
    worldHeight: 320,
    ...over,
  };
}

/** Population-mean `size` over the live agents. */
function meanSize(sim: ReturnType<typeof createSimulation>): number {
  const { alive, agentCapacity, traits } = sim.world;
  const size = traits[SIZE];
  let sum = 0;
  let n = 0;
  for (let s = 0; s < agentCapacity; s++) {
    if (alive[s] === 0) continue;
    sum += size[s];
    n++;
  }
  return n === 0 ? 0 : sum / n;
}

describe('metabolic exponent', () => {
  it('is inert at the default (1): cost matches the linear-in-size formula exactly', () => {
    const w = new World(8, 8);
    const s = w.spawnAgent();
    w.traits[SIZE][s] = 1.7;
    w.traits[SPEED][s] = 0.9;
    w.traits[METABOLIC_EFFICIENCY][s] = 1.1;
    const p = params();
    const size = w.traits[SIZE][s];
    const speed = w.traits[SPEED][s];
    const efficiency = w.traits[METABOLIC_EFFICIENCY][s];
    // The default exponent must take exactly the current arithmetic (no Math.pow).
    const expected = (p.baseMetabolicCost * (size + speed)) / efficiency;
    expect(metabolicCost(w, s, p)).toBe(expected);
  });

  it('raises the size term to the exponent (a sublinear exponent makes large bodies cheaper)', () => {
    const w = new World(8, 8);
    const s = w.spawnAgent();
    w.traits[SIZE][s] = 2.0; // a large body
    w.traits[SPEED][s] = 0.5;
    w.traits[METABOLIC_EFFICIENCY][s] = 1.0;
    const linear = metabolicCost(w, s, params({ metabolicExponent: 1 }));
    const sublinear = metabolicCost(w, s, params({ metabolicExponent: 0.67 }));
    // 2^0.67 < 2, so the sublinear drain on a >1 body is strictly lower.
    expect(sublinear).toBeLessThan(linear);
    const size = w.traits[SIZE][s];
    const speed = w.traits[SPEED][s];
    const efficiency = w.traits[METABOLIC_EFFICIENCY][s];
    const expected = (params().baseMetabolicCost * (Math.pow(size, 0.67) + speed)) / efficiency;
    expect(sublinear).toBe(expected);
  });

  it('reproduces a run exactly with a non-unit exponent (determinism)', () => {
    const p = params({ metabolicExponent: 0.67, initialPopulation: 140, foodAbundance: 260, seed: 7 });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(400);
      return {
        population: sim.world.population,
        size: Array.from(sim.world.traits[SIZE]),
        x: Array.from(sim.world.x),
      };
    };
    expect(run()).toEqual(run());
  });

  it('shifts body size upward: a sublinear exponent ends with a higher mean size than isometric', () => {
    // Same seed and ecology; the only difference is the exponent. Below 1, larger
    // bodies are relatively cheaper to run, so selection tolerates a higher size.
    const base = {
      initialPopulation: 160,
      foodAbundance: 260,
      seed: 4,
      predation: false,
    };
    const isometric = createSimulation(params({ ...base, metabolicExponent: 1 }));
    const sublinear = createSimulation(params({ ...base, metabolicExponent: 0.67 }));
    isometric.run(2500);
    sublinear.run(2500);
    expect(sublinear.world.population).toBeGreaterThan(0);
    expect(meanSize(sublinear)).toBeGreaterThan(meanSize(isometric));
  }, 30000);
});
