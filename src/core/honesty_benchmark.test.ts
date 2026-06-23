import { describe, it, expect } from 'vitest';
import { createSimulation, type Simulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SENSE_RADIUS, RESISTANCE } from './genome.ts';

/**
 * The programme-wide honesty benchmark (science_integration_plan.md §1), as an
 * executable multi-seed test. The synthesis designs *against* treating intelligence,
 * disease-resistance, or culture as monotone, irreversible upgrades. So for each
 * capability that has **landed** — cognition (072 `cognitionCost` paired with 079
 * `socialBrain`), disease resistance (074 `disease` + the costly `resistance` trait),
 * and culture (080–082 `knowledge`) — the population-mean of the relevant quantity
 * must, across a seed set, both **sometimes regress** (end well below an earlier,
 * higher level) and **sometimes fail to appear** (never climb meaningfully above its
 * baseline). Neither is monotonically non-decreasing on the default path: at least
 * one seed declines and at least one fails to rise.
 *
 * This test only *audits* landed capabilities; it re-implements none. The capabilities
 * live in `params.ts`/`energy.ts`/`disease.ts`/`culture.ts`; each capability's enabling
 * toggles are set explicitly here. Were a capability not yet present, its block would
 * be guarded/skipped (the scope guard in the prompt); all three are present at this
 * version, so all three are asserted.
 */

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 300, worldHeight: 300, ...over };
}

/** Population-mean of one genome trait column over the live agents (0 if none). */
function meanTrait(sim: Simulation, trait: number): number {
  const { alive, agentCapacity, traits } = sim.world;
  const col = traits[trait];
  let sum = 0;
  let n = 0;
  for (let s = 0; s < agentCapacity; s++) {
    if (alive[s] === 0) continue;
    sum += col[s];
    n++;
  }
  return n === 0 ? 0 : sum / n;
}

/** Population-mean `knowledge` over the live agents (0 if none). */
function meanKnowledge(sim: Simulation): number {
  const { alive, agentCapacity, knowledge } = sim.world;
  let sum = 0;
  let n = 0;
  for (let s = 0; s < agentCapacity; s++) {
    if (alive[s] === 0) continue;
    sum += knowledge[s];
    n++;
  }
  return n === 0 ? 0 : sum / n;
}

/**
 * Run one seed and return its sampled trajectory: a post-settling baseline (index 0)
 * followed by `checkpoints` further samples of `measure`, taken `ticksPer` ticks
 * apart. The leading `settle` ticks let the founders' random initial mean relax
 * before the baseline is read.
 */
function trajectory(
  build: () => Simulation,
  measure: (sim: Simulation) => number,
  settle: number,
  checkpoints: number,
  ticksPer: number,
): number[] {
  const sim = build();
  sim.run(settle);
  const series = [measure(sim)];
  for (let c = 0; c < checkpoints; c++) {
    sim.run(ticksPer);
    series.push(measure(sim));
  }
  return series;
}

/** Peak (running max) of a trajectory, including its baseline. */
function peakOf(series: number[]): number {
  let peak = series[0];
  for (const v of series) if (v > peak) peak = v;
  return peak;
}

/** Regressed: the quantity ended well below an earlier, higher level (peak − end). A
 *  monotonically non-decreasing trajectory never does this. Captures both a
 *  selection-driven net decline and a build-then-lose U-shape. */
function regressed(series: number[], margin: number): boolean {
  return peakOf(series) - series[series.length - 1] > margin;
}

/** Failed to appear: the quantity never climbed meaningfully above its baseline. */
function failedToRise(series: number[], margin: number): boolean {
  return peakOf(series) - series[0] <= margin;
}

const SEEDS_8 = [1, 2, 3, 4, 5, 6, 7, 8];
const SEEDS_16 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

describe('honesty benchmark — no monotone, irreversible upgrade on the default path', () => {
  it('cognition (senseRadius) sometimes regresses and sometimes fails to appear across seeds', () => {
    // Cognition is a genuine trade-off: 072 charges `senseRadius` (cognitionCost), and
    // 079 repays it only in company (socialBrain). Founders start at the random mean;
    // where the social payoff is absent or outweighed, selection trims mean senseRadius
    // (a decline), and across seeds it does not reliably climb above baseline.
    const trajectories = SEEDS_8.map((seed) =>
      trajectory(
        () =>
          createSimulation(
            params({
              seed,
              initialPopulation: 120,
              foodAbundance: 240,
              cognitionCost: 1.5,
              socialBrain: true,
              socialBrainGain: 2,
              predation: false,
            }),
          ),
        (sim) => meanTrait(sim, SENSE_RADIUS),
        300,
        6,
        300,
      ),
    );
    const margin = 1.0; // senseRadius ranges 0..50
    expect(trajectories.some((t) => regressed(t, margin))).toBe(true);
    expect(trajectories.some((t) => failedToRise(t, margin))).toBe(true);
  }, 30000);

  it('disease resistance sometimes regresses and sometimes fails to appear across seeds', () => {
    // The `resistance` trait is costly (074): it only pays under sustained pathogen
    // pressure and drifts/erodes when the disease wanes or fails to take hold. Across
    // seeds mean resistance both rises-then-falls (or net-declines) and fails to appear.
    const trajectories = SEEDS_8.map((seed) =>
      trajectory(
        () =>
          createSimulation(
            params({
              seed,
              initialPopulation: 160,
              foodAbundance: 300,
              disease: true,
              transmissionRate: 0.06,
              recoveryRate: 0.03,
              diseaseMortality: 0.3,
              predation: false,
            }),
          ),
        (sim) => meanTrait(sim, RESISTANCE),
        300,
        6,
        300,
      ),
    );
    const margin = 0.03; // resistance ranges 0..1
    expect(trajectories.some((t) => regressed(t, margin))).toBe(true);
    expect(trajectories.some((t) => failedToRise(t, margin))).toBe(true);
  }, 30000);

  it('culture (knowledge) sometimes regresses and sometimes fails to appear across seeds', () => {
    // Knowledge is non-genetic and lost on death (080), and maintenance fails below a
    // critical reachable population (082). Poised at the build/no-build edge (a tight
    // food regime with catastrophes), some seeds build knowledge and then lose it
    // (regression) while others never build it (no appearance) — non-monotone by design.
    const trajectories = SEEDS_16.map((seed) =>
      trajectory(
        () =>
          createSimulation(
            params({
              seed,
              worldWidth: 170,
              worldHeight: 170,
              initialPopulation: 80,
              foodAbundance: 80,
              foodRegenRate: 1.3,
              culture: true,
              transmissionFidelity: 0.9,
              knowledgeForagingGain: 0.8,
              knowledgeDecay: 0.03,
              criticalCultureN: 14,
              predation: true,
              catastrophes: true,
            }),
          ),
        meanKnowledge,
        300,
        9,
        300,
      ),
    );
    const margin = 0.05; // knowledge ranges 0..1
    expect(trajectories.some((t) => regressed(t, margin))).toBe(true);
    expect(trajectories.some((t) => failedToRise(t, margin))).toBe(true);
  }, 45000);
});
