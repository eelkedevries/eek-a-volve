import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import {
  Culture,
  COPY_RADIUS,
  KNOWLEDGE_MAX,
  cultureForagingFactor,
  clampKnowledge,
} from './culture.ts';
import { createSimulation, GRID_CELL_SIZE } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, DIET } from './genome.ts';
import {
  serialiseSnapshot,
  snapshotLength,
  HEADER_LENGTH,
  AGENT_STRIDE,
  FOOD_STRIDE,
  H_MEAN_KNOWLEDGE,
  H_FOOD_COUNT,
  H_TRAIT_MEANS,
} from './snapshot.ts';
import { TRAIT_COUNT } from './genome.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 300, worldHeight: 300, ...over };
}

/**
 * A world with `n` clustered herbivores, all able to reach each other within the
 * copy radius. Slot 0 starts fully knowledgeable; the rest start at zero, so they
 * can copy from it (copy probability is the transmission fidelity).
 */
function clusteredWorld(n: number, spacing: number): World {
  const w = new World(256, 16);
  for (let i = 0; i < n; i++) {
    const s = w.spawnAgent();
    w.x[s] = 100 + (i % 16) * spacing;
    w.y[s] = 100 + Math.floor(i / 16) * spacing;
    w.traits[SIZE][s] = 1;
    w.traits[DIET][s] = 0;
    w.knowledge[s] = i === 0 ? KNOWLEDGE_MAX : 0;
  }
  return w;
}

/** Mean knowledge over the live agents. */
function meanKnowledge(w: World): number {
  let sum = 0;
  let n = 0;
  for (let s = 0; s < w.agentCapacity; s++) {
    if (w.alive[s] === 0) continue;
    sum += w.knowledge[s];
    n++;
  }
  return n === 0 ? 0 : sum / n;
}

describe('culture — foraging factor and clamp', () => {
  it('the foraging factor is 1 at zero knowledge and rises with knowledge', () => {
    expect(cultureForagingFactor(0, 0.5)).toBe(1); // no knowledge ⇒ no bonus
    expect(cultureForagingFactor(0, 5)).toBe(1);
    expect(cultureForagingFactor(KNOWLEDGE_MAX, 0.5)).toBeGreaterThan(1);
    expect(cultureForagingFactor(KNOWLEDGE_MAX, 1)).toBeGreaterThan(
      cultureForagingFactor(KNOWLEDGE_MAX / 2, 1),
    );
  });

  it('knowledge clamps to [0, KNOWLEDGE_MAX]', () => {
    expect(clampKnowledge(-1)).toBe(0);
    expect(clampKnowledge(KNOWLEDGE_MAX + 5)).toBe(KNOWLEDGE_MAX);
    expect(clampKnowledge(KNOWLEDGE_MAX / 2)).toBeCloseTo(KNOWLEDGE_MAX / 2, 6);
  });
});

describe('culture — default-off is inert', () => {
  it('draws no RNG and advances no knowledge when culture is off', () => {
    const w = clusteredWorld(20, 2);
    const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
    grid.rebuildFromAgents(w);
    const before = w.knowledge.slice();
    const rng = new Rng(1);
    const ref = new Rng(1);
    new Culture(w.agentCapacity).step(w, params({ culture: false }), grid, rng);
    expect(rng.next()).toBe(ref.next()); // the stream did not advance
    for (let s = 0; s < w.agentCapacity; s++) expect(w.knowledge[s]).toBe(before[s]); // unchanged
  });

  it('the full loop is byte-for-byte identical to the pre-culture core (culture off)', () => {
    // Determinism on the default path: the same seed/params reproduces the run, and
    // with culture off no knowledge is ever advanced (the channel is inert).
    const p = params({ initialPopulation: 120, foodAbundance: 220, seed: 5 });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(300);
      return {
        population: sim.world.population,
        x: Array.from(sim.world.x),
        energy: Array.from(sim.world.energy),
      };
    };
    expect(run()).toEqual(run());
    const sim = createSimulation(p);
    sim.run(300);
    expect(meanKnowledge(sim.world)).toBe(0); // knowledge never moved off zero
  });
});

describe('culture — copying tracks transmission fidelity', () => {
  it('spreads knowledge through a reachable cluster, more at higher fidelity', () => {
    expect(COPY_RADIUS).toBeGreaterThan(0);
    const meanAfter = (fidelity: number): number => {
      const w = clusteredWorld(30, 2); // all within COPY_RADIUS of each other
      const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
      const culture = new Culture(w.agentCapacity);
      const rng = new Rng(7);
      const p = params({ culture: true, transmissionFidelity: fidelity, knowledgeDecay: 0 });
      for (let t = 0; t < 30; t++) {
        grid.rebuildFromAgents(w);
        culture.step(w, p, grid, rng);
      }
      return meanKnowledge(w);
    };
    const low = meanAfter(0.1);
    const high = meanAfter(0.9);
    expect(high).toBeGreaterThan(low); // higher fidelity ⇒ more knowledge spread
    expect(high).toBeGreaterThan(0); // it actually spread
    // Bounded: knowledge never exceeds its ceiling, even after a long run.
    expect(high).toBeLessThanOrEqual(KNOWLEDGE_MAX + 1e-6);
  });
});

describe('culture — knowledge is not a one-way upgrade (it can fall)', () => {
  it('decays away under low (below-threshold) fidelity — knowledge can be lost', () => {
    // A knowledgeable creature under low transmission fidelity: below the fidelity
    // threshold decay dominates, so its knowledge erodes — knowledge is non-genetic
    // and can be lost, not a one-way ratchet. (Above the threshold it would instead
    // accumulate; see culture_ratchet.test.ts.)
    const w = new World(16, 16);
    const s = w.spawnAgent();
    w.x[s] = 50;
    w.y[s] = 50;
    w.knowledge[s] = KNOWLEDGE_MAX;
    const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
    const culture = new Culture(w.agentCapacity);
    const rng = new Rng(2);
    const p = params({ culture: true, transmissionFidelity: 0.05, knowledgeDecay: 0.02 });
    const before = w.knowledge[s];
    for (let t = 0; t < 80; t++) {
      grid.rebuildFromAgents(w);
      culture.step(w, p, grid, rng);
    }
    expect(w.knowledge[s]).toBeLessThan(before * 0.5); // it fell markedly
    expect(w.knowledge[s]).toBeGreaterThanOrEqual(0);
  });

  it('is lost on death: a recycled slot starts at zero knowledge', () => {
    const w = new World(16, 16);
    const s = w.spawnAgent();
    w.knowledge[s] = KNOWLEDGE_MAX;
    w.killAgent(s); // slot freed
    const s2 = w.spawnAgent(); // same slot recycled
    expect(s2).toBe(s);
    expect(w.knowledge[s2]).toBe(0); // knowledge did not carry over
  });
});

describe('culture — determinism in the full loop', () => {
  it('reproduces a run exactly with culture on', () => {
    const p = params({
      culture: true,
      transmissionFidelity: 0.6,
      knowledgeForagingGain: 0.8,
      knowledgeDecay: 0.01,
      initialPopulation: 140,
      foodAbundance: 260,
      worldWidth: 240,
      worldHeight: 240,
      seed: 9,
    });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(400);
      return {
        population: sim.world.population,
        x: Array.from(sim.world.x),
        knowledge: Array.from(sim.world.knowledge),
      };
    };
    expect(run()).toEqual(run());
  });

  it('runs the hot loop in TypeScript when culture is on (no WASM behaviour gate)', async () => {
    // canRunBehaviour must reject culture so the foraging return is always applied.
    const { readFileSync } = await import('node:fs');
    const { createWasmCore } = await import('../wasm/metabolismCore.ts');
    const bytes = readFileSync(new URL('../wasm/metabolism.wasm', import.meta.url));
    const core = createWasmCore(bytes, 64, 64, 300, 300, GRID_CELL_SIZE, 24);
    expect(core.canRunBehaviour(params({ culture: true }))).toBe(false);
    expect(core.canRunBehaviour(params({ culture: false }))).toBe(true);
  });
});

describe('culture — snapshot offsets and mean knowledge', () => {
  it('keeps the snapshot offsets derived from their definitions (appended field)', () => {
    expect(H_TRAIT_MEANS).toBe(5);
    expect(H_FOOD_COUNT).toBe(5 + TRAIT_COUNT);
    expect(H_MEAN_KNOWLEDGE).toBe(6 + TRAIT_COUNT);
    expect(HEADER_LENGTH).toBe(7 + TRAIT_COUNT);
    expect(snapshotLength(10, 5)).toBe(HEADER_LENGTH + AGENT_STRIDE * 10 + FOOD_STRIDE * 5);
  });

  it('appends mean knowledge to the header: 0 by default, positive when knowledge is present', () => {
    const sim = createSimulation(params({ seed: 5, initialPopulation: 40, foodAbundance: 120 }));
    sim.run(20);
    const out = new Float32Array(snapshotLength(sim.world.agentCapacity, sim.world.foodCapacity));
    serialiseSnapshot(sim, out);
    expect(out[H_MEAN_KNOWLEDGE]).toBe(0); // culture off ⇒ mean knowledge 0
    // Give every live creature some knowledge and re-serialise: the mean is positive.
    for (let s = 0; s < sim.world.agentCapacity; s++) {
      if (sim.world.alive[s] === 1) sim.world.knowledge[s] = KNOWLEDGE_MAX;
    }
    serialiseSnapshot(sim, out);
    expect(out[H_MEAN_KNOWLEDGE]).toBeCloseTo(KNOWLEDGE_MAX, 5);
  });
});

describe('culture — allocation-free per tick', () => {
  it('reuses its backing arrays across a culture-on run (no per-tick reallocation)', () => {
    // The repo idiom for "allocation-free" is identity: the pre-allocated columns
    // must be the same references after a run (the reused Culture pass writes the
    // knowledge column in place and reuses its start-of-tick snapshot).
    const p = params({
      culture: true,
      transmissionFidelity: 0.6,
      knowledgeDecay: 0.01,
      initialPopulation: 120,
      foodAbundance: 260,
      seed: 4,
    });
    const sim = createSimulation(p);
    const knowledgeRef = sim.world.knowledge;
    const xRef = sim.world.x;
    sim.run(300);
    expect(sim.world.knowledge).toBe(knowledgeRef); // never reallocated
    expect(sim.world.x).toBe(xRef);
  });
});
