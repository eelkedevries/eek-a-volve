import { describe, it, expect } from 'vitest';
import { createSimulation, type Simulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { REGION_COUNT } from './transitions.ts';

/**
 * Emergence ablation harness (prompt 086). The Stage-3/4 capacities are detector- or
 * threshold-driven by construction, so their honest label is **[design-abstraction]**
 * ([speculative] for transitions). "Emergent" is reserved for a capacity that recurs
 * reproducibly across seeds **with its detector disabled**. This harness runs a
 * capacity detector-enabled vs detector-disabled across the same seeds and checks
 * whether the target signal appears without the detector. Being scaffolded, it should
 * **not** — which is exactly the evidence that keeps the [design-abstraction] label
 * honest.
 *
 * It adds no new simulation rule and no run-changing parameter — it only runs the
 * existing simulation with the relevant detector toggle on vs off — so it does not
 * change the default run. See docs-dev/reference/secondary_background/emergence_audit.md.
 */

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 200, worldHeight: 200, ...over };
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

/** Peak mean knowledge reached over a run (sampled each window). */
function peakMeanKnowledge(p: SimulationParameters, windows: number, ticksPer: number): number {
  const sim = createSimulation(p);
  let peak = 0;
  for (let w = 0; w < windows; w++) {
    sim.run(ticksPer);
    const k = meanKnowledge(sim);
    if (k > peak) peak = k;
  }
  return peak;
}

/** Number of regions ever in the complexity state over a run. */
function regionsEverActive(p: SimulationParameters, ticks: number): number {
  const sim = createSimulation(p);
  const ever = new Array<boolean>(REGION_COUNT).fill(false);
  for (let t = 0; t < ticks; t++) {
    sim.step();
    for (let r = 0; r < REGION_COUNT; r++) {
      if (sim.transitions.regionState(r).active) ever[r] = true;
    }
  }
  return ever.filter(Boolean).length;
}

const SEEDS = [1, 2, 3, 4];

/** A dense ecology in which culture builds strongly when its detector is enabled. */
function cultureEcology(seed: number, culture: boolean): SimulationParameters {
  return params({
    seed,
    worldWidth: 140,
    worldHeight: 140,
    initialPopulation: 150,
    foodAbundance: 180,
    foodRegenRate: 3,
    predation: true,
    catastrophes: false,
    culture,
    transmissionFidelity: 0.9,
    knowledgeForagingGain: 0.8,
    knowledgeDecay: 0.02,
    criticalCultureN: 4,
  });
}

describe('emergence ablation — culture (knowledge) is scaffolded, not emergent', () => {
  it('knowledge appears with the culture detector on, and not with it off, across seeds', () => {
    for (const seed of SEEDS) {
      const enabled = peakMeanKnowledge(cultureEcology(seed, true), 6, 250);
      const ablated = peakMeanKnowledge(cultureEcology(seed, false), 6, 250);
      // Detector disabled (culture off): the knowledge channel is inert, so the signal
      // never appears — keeping the [design-abstraction] label honest.
      expect(ablated).toBe(0);
      // Detector enabled, same ecology: the signal does appear (a sanity check that the
      // ablation is contrastive, not vacuous).
      expect(enabled).toBeGreaterThan(0.1);
    }
  }, 45000);
});

describe('emergence ablation — the transitions complexity state is scaffolded, not emergent', () => {
  it('the complexity state appears with the transitions detector on, and not with it off', () => {
    // Identical dense, high-knowledge ecology in both arms; only the transitions detector
    // flag differs. Without the detector no region ever enters the complexity state, so
    // the state is the product of the modeller-set detector, not open-ended emergence.
    for (const seed of SEEDS) {
      const ecology = {
        seed,
        worldWidth: 200,
        worldHeight: 200,
        initialPopulation: 160,
        foodAbundance: 200,
        foodRegenRate: 3,
        predation: true,
        culture: true,
        transmissionFidelity: 0.9,
        knowledgeForagingGain: 0.3,
        knowledgeDecay: 0.02,
        criticalCultureN: 4,
        transitionDensity: 14,
        transitionTechnologyGain: 1.0,
      } as const;
      const enabled = regionsEverActive(params({ ...ecology, transitions: true }), 1000);
      const ablated = regionsEverActive(params({ ...ecology, transitions: false }), 1000);
      expect(ablated).toBe(0); // no detector ⇒ no complexity state
      expect(enabled).toBeGreaterThan(0); // detector on ⇒ the state arises
    }
  }, 45000);
});
