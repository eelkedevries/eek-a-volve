import { describe, it, expect } from 'vitest';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SENSE_RADIUS } from './genome.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return {
    ...DEFAULT_PARAMETERS,
    worldWidth: 320,
    worldHeight: 320,
    ...over,
  };
}

/** Population-mean `senseRadius` over the live agents. */
function meanSenseRadius(sim: ReturnType<typeof createSimulation>): number {
  const { alive, agentCapacity, traits } = sim.world;
  const sense = traits[SENSE_RADIUS];
  let sum = 0;
  let n = 0;
  for (let s = 0; s < agentCapacity; s++) {
    if (alive[s] === 0) continue;
    sum += sense[s];
    n++;
  }
  return n === 0 ? 0 : sum / n;
}

describe('cognition cost', () => {
  it('reproduces a costed run exactly (determinism with cognitionCost > 0)', () => {
    const p = params({ cognitionCost: 1.5, initialPopulation: 120, foodAbundance: 240, seed: 7 });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(400);
      return {
        population: sim.world.population,
        senseRadius: Array.from(sim.world.traits[SENSE_RADIUS]),
        x: Array.from(sim.world.x),
      };
    };
    expect(run()).toEqual(run());
  });

  it('bounds perception: a cognition cost lowers mean senseRadius versus a free control', () => {
    // Same seed and ecology; the only difference is the cognition cost. With no
    // foraging payoff wired to perception beyond what the default behaviour
    // gives, charging `senseRadius` shifts its selected value downward.
    const base = {
      initialPopulation: 160,
      foodAbundance: 260,
      seed: 4,
      predation: false,
    };
    const control = createSimulation(params({ ...base, cognitionCost: 0 }));
    const costed = createSimulation(params({ ...base, cognitionCost: 2 }));
    control.run(2500);
    costed.run(2500);
    expect(costed.world.population).toBeGreaterThan(0);
    expect(meanSenseRadius(costed)).toBeLessThan(meanSenseRadius(control));
  }, 30000);
});
