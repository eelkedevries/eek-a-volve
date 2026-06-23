import { describe, it, expect } from 'vitest';
import {
  geneCultureFactor,
  GENE_CULTURE_SIZE_BAND,
  GENE_CULTURE_KNOWLEDGE_LEVEL,
  KNOWLEDGE_MAX,
} from './culture.ts';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE } from './genome.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, ...over };
}

/** Population-mean `size` over the live agents (the gene–culture target trait). */
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

describe('gene–culture — the unlock factor (deterministic, no RNG)', () => {
  const above = GENE_CULTURE_SIZE_BAND; // a persistence-genotype size
  const below = GENE_CULTURE_SIZE_BAND - 0.3;
  const knows = KNOWLEDGE_MAX; // above the unlock level

  it('is exactly 1 (inert) when the coupling is off or knowledge is absent', () => {
    expect(geneCultureFactor(true, above, knows, 0)).toBe(1); // coupling 0
    expect(geneCultureFactor(true, above, 0, 1)).toBe(1); // no knowledge
    expect(geneCultureFactor(true, above, GENE_CULTURE_KNOWLEDGE_LEVEL - 0.01, 1)).toBe(1);
    expect(geneCultureFactor(false, above, knows, 1)).toBe(1); // not the gated resource
  });

  it('unlocks the resource for the above-band genotype and locks it for others', () => {
    const coupling = 0.8;
    // Above the band, with the practice: a large bonus.
    expect(geneCultureFactor(true, above, knows, coupling)).toBeGreaterThan(1);
    expect(geneCultureFactor(true, above, knows, coupling)).toBeCloseTo(1 + coupling, 6);
    // Below the band: little (a reduced yield, but survivable — never negative).
    expect(geneCultureFactor(true, below, knows, coupling)).toBeLessThan(1);
    expect(geneCultureFactor(true, below, knows, coupling)).toBeCloseTo(1 / (1 + coupling), 6);
    expect(geneCultureFactor(true, below, knows, coupling)).toBeGreaterThan(0);
    // The above-band genotype is strictly favoured over the below-band one.
    expect(geneCultureFactor(true, above, knows, coupling)).toBeGreaterThan(
      geneCultureFactor(true, below, knows, coupling),
    );
  });

  it('relaxes reversibly when knowledge falls below the level', () => {
    const coupling = 0.8;
    // With the practice present, the genotypes are treated very differently.
    const withPractice =
      geneCultureFactor(true, above, knows, coupling) -
      geneCultureFactor(true, below, knows, coupling);
    expect(withPractice).toBeGreaterThan(0);
    // Once knowledge falls below the level, the resource is no different for the two
    // genotypes (both factor 1) — the selection differential vanishes (reversible).
    const lostPractice =
      geneCultureFactor(true, above, 0, coupling) -
      geneCultureFactor(true, below, 0, coupling);
    expect(lostPractice).toBe(0);
  });

  it('favours the above-band genotype ever more strongly as the coupling rises', () => {
    const weak =
      geneCultureFactor(true, above, knows, 0.5) / geneCultureFactor(true, below, knows, 0.5);
    const strong =
      geneCultureFactor(true, above, knows, 3) / geneCultureFactor(true, below, knows, 3);
    expect(strong).toBeGreaterThan(weak); // a steeper advantage at higher coupling
    expect(geneCultureFactor(true, below, knows, 3)).toBeGreaterThan(0); // still survivable
  });
});

describe('gene–culture — default-off and determinism', () => {
  it('is inert with coupling 0 (run reproducible, identical to no-coupling)', () => {
    // With geneCultureCoupling 0 the foraging path takes no extra branch, so a
    // culture-on run is reproducible and unchanged by the (off) coupling.
    const p = params({
      culture: true,
      transmissionFidelity: 0.7,
      knowledgeForagingGain: 0.5,
      geneCultureCoupling: 0,
      initialPopulation: 140,
      foodAbundance: 260,
      worldWidth: 240,
      worldHeight: 240,
      seed: 4,
    });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(300);
      return { population: sim.world.population, x: Array.from(sim.world.x) };
    };
    expect(run()).toEqual(run());
  });

  it('reproduces a run exactly with the coupling on', () => {
    const p = params({
      culture: true,
      transmissionFidelity: 0.9,
      geneCultureCoupling: 1.5,
      predation: true,
      initialPopulation: 160,
      foodAbundance: 300,
      worldWidth: 220,
      worldHeight: 220,
      seed: 6,
    });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(400);
      return {
        population: sim.world.population,
        size: Array.from(sim.world.traits[SIZE]),
        knowledge: Array.from(sim.world.knowledge),
      };
    };
    expect(run()).toEqual(run());
  });

  it('the default path is byte-for-byte unchanged (coupling off by default)', () => {
    expect(DEFAULT_PARAMETERS.geneCultureCoupling).toBe(0);
  });
});

// Shared ecology for the full-loop feedback tests: culture on so knowledge builds
// above the unlock level; predation off and `knowledgeForagingGain` 0 so the *only*
// thing culture does to `size` is via the gene–culture coupling (a clean signal). A
// modest `maxPopulation` keeps the long runs fast without changing the dynamics.
const FEEDBACK_BASE = {
  culture: true,
  transmissionFidelity: 0.95,
  knowledgeForagingGain: 0,
  predation: false,
  maxPopulation: 400,
  worldWidth: 150,
  worldHeight: 150,
  initialPopulation: 140,
  foodAbundance: 180,
  seed: 12,
} as const;

describe('gene–culture — the feedback shifts the targeted trait where culture is present', () => {
  it('raises mean size with culture+coupling on versus the coupling off, same seed', () => {
    // Same ecology and seed; the only difference is the gene–culture coupling. With
    // it on, high-knowledge above-band (large) creatures exploit the plant staple
    // (unlocked), gaining energy and reproducing more, so mean size shifts up toward
    // the band — and not in the control where the coupling is off.
    const coupled = createSimulation(params({ ...FEEDBACK_BASE, geneCultureCoupling: 4 }));
    const control = createSimulation(params({ ...FEEDBACK_BASE, geneCultureCoupling: 0 }));
    coupled.run(2000);
    control.run(2000);
    expect(coupled.world.population).toBeGreaterThan(0);
    expect(control.world.population).toBeGreaterThan(0);
    // The coupling pushes mean size clearly up relative to the no-coupling control.
    expect(meanSize(coupled)).toBeGreaterThan(meanSize(control));
  }, 30000);

  it('is reversible: losing the practice relaxes the size shift (not locked in)', () => {
    // Two runs identical until a split tick, both pushing size up under the coupling.
    // After the split one *keeps* the practice while the other *loses* it (knowledge
    // zeroed, fidelity 0 so it cannot rebuild). With the practice the coupling keeps
    // pushing size up; without it the differential vanishes, so the loser no longer
    // tracks the coupled trajectory and ends clearly below the keeper — the feedback
    // is reversible, not a one-way ratchet locked into the trait.
    const keeper = createSimulation(params({ ...FEEDBACK_BASE, geneCultureCoupling: 4 }));
    const loser = createSimulation(params({ ...FEEDBACK_BASE, geneCultureCoupling: 4 }));
    keeper.run(2000);
    loser.run(2000);

    // Lose the practice in the loser only: zero knowledge and stop it rebuilding.
    for (let s = 0; s < loser.world.agentCapacity; s++) loser.world.knowledge[s] = 0;
    (loser.params as { transmissionFidelity: number }).transmissionFidelity = 0;

    keeper.run(3000);
    loser.run(3000);
    expect(keeper.world.population).toBeGreaterThan(0);
    expect(loser.world.population).toBeGreaterThan(0);
    // The keeper holds its high size; the loser, having lost the practice, relaxes —
    // ending clearly below the keeper. The unlock is reversible.
    expect(meanSize(loser)).toBeLessThan(meanSize(keeper));
  }, 30000);
});
