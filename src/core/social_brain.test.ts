import { describe, it, expect } from 'vitest';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { socialForagingFactor, SOCIAL_GROUP_RADIUS } from './behaviour.ts';
import { SENSE_RADIUS, TRAIT_RANGES } from './genome.ts';

const SENSE_MAX = TRAIT_RANGES[SENSE_RADIUS].max;

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, predation: false, ...over };
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

describe('social brain — foraging factor', () => {
  it('gives no return to a solitary forager and is bounded and saturating', () => {
    expect(SOCIAL_GROUP_RADIUS).toBeGreaterThan(0);
    const gain = 2;
    // Group size 1 (alone): no social return, whatever the sense radius.
    expect(socialForagingFactor(1, SENSE_MAX, gain)).toBe(1);
    expect(socialForagingFactor(1, 0, gain)).toBe(1);
    // A bigger group and a bigger sense radius both raise the return.
    expect(socialForagingFactor(5, SENSE_MAX, gain)).toBeGreaterThan(socialForagingFactor(2, SENSE_MAX, gain));
    expect(socialForagingFactor(5, SENSE_MAX, gain)).toBeGreaterThan(socialForagingFactor(5, SENSE_MAX / 2, gain));
    // Saturating: diminishing marginal gain as the group grows.
    const early = socialForagingFactor(3, SENSE_MAX, gain) - socialForagingFactor(2, SENSE_MAX, gain);
    const late = socialForagingFactor(12, SENSE_MAX, gain) - socialForagingFactor(11, SENSE_MAX, gain);
    expect(late).toBeLessThan(early);
    // Bounded above by 1 + gain (group → ∞, full sense radius).
    expect(socialForagingFactor(1e6, SENSE_MAX, gain)).toBeLessThanOrEqual(1 + gain);
    expect(socialForagingFactor(1e6, SENSE_MAX, gain)).toBeGreaterThan(1 + gain - 1e-3);
  });
});

describe('social brain — determinism and the cognition trade-off', () => {
  it('reproduces a run exactly with the social brain on (determinism)', () => {
    const p = params({
      socialBrain: true,
      socialBrainGain: 3,
      cognitionCost: 1,
      worldWidth: 180,
      worldHeight: 180,
      initialPopulation: 200,
      foodAbundance: 300,
      seed: 7,
    });
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

  it('a social return lets a dense, grouping population sustain a higher mean senseRadius than the cost alone', () => {
    // Same dense ecology, same seed, cognition cost on in both. The only difference
    // is the social return: with it, a big sense radius repays in company, so a
    // higher mean senseRadius is sustained than under the cost without the return.
    const base = {
      worldWidth: 170,
      worldHeight: 170,
      initialPopulation: 300,
      foodAbundance: 360,
      cognitionCost: 2,
      seed: 4,
    };
    const withReturn = createSimulation(params({ ...base, socialBrain: true, socialBrainGain: 6 }));
    const costOnly = createSimulation(params({ ...base, socialBrain: false }));
    withReturn.run(2500);
    costOnly.run(2500);
    expect(withReturn.world.population).toBeGreaterThan(0);
    expect(costOnly.world.population).toBeGreaterThan(0);
    expect(meanSenseRadius(withReturn)).toBeGreaterThan(meanSenseRadius(costOnly));
  }, 30000);

  it('is non-monotonic and reversible: with the cost on but the payoff removed, mean senseRadius falls', () => {
    // Cognition cost on, social return OFF: the cost is unrepaid, so the founding
    // mean senseRadius (a broad spread, ~mid-range) is selected downward over the
    // run — intelligence here can fall, it is not a one-way ratchet.
    const base = {
      worldWidth: 170,
      worldHeight: 170,
      initialPopulation: 300,
      foodAbundance: 360,
      cognitionCost: 2.5,
      socialBrain: false,
      seed: 11,
    };
    const start = createSimulation(params(base));
    const startMean = meanSenseRadius(start);
    const sim = createSimulation(params(base));
    sim.run(2500);
    expect(sim.world.population).toBeGreaterThan(0);
    // The payoff is absent, so cognition is a net loss and the mean falls — it does
    // not rise monotonically (the honesty benchmark: a reversible, non-monotonic
    // cognitive trade-off, not an upgrade).
    expect(meanSenseRadius(sim)).toBeLessThan(startMean);
  }, 30000);
});
