import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import {
  Culture,
  KNOWLEDGE_MAX,
  FIDELITY_THRESHOLD,
  INNOVATION_INCREMENT,
  longevityFactor,
} from './culture.ts';
import { createSimulation, GRID_CELL_SIZE } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, DIET } from './genome.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 300, worldHeight: 300, ...over };
}

/**
 * A clustered group of herbivores all within the copy radius, each seeded with the
 * same small starting knowledge `seed` (so pure copying alone could never exceed
 * `seed` — only innovation can push the group above it).
 */
function seededCluster(n: number, spacing: number, seed: number): World {
  const w = new World(256, 16);
  for (let i = 0; i < n; i++) {
    const s = w.spawnAgent();
    w.x[s] = 100 + (i % 16) * spacing;
    w.y[s] = 100 + Math.floor(i / 16) * spacing;
    w.traits[SIZE][s] = 1;
    w.traits[DIET][s] = 0;
    w.knowledge[s] = seed;
  }
  return w;
}

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

/** Run the Culture pass over a seeded cluster for `ticks` ticks; return mean knowledge. */
function runCluster(p: SimulationParameters, seed: number, ticks: number, rngSeed = 7): number {
  const w = seededCluster(30, 2, seed);
  const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
  const culture = new Culture(w.agentCapacity);
  const rng = new Rng(rngSeed);
  for (let t = 0; t < ticks; t++) {
    grid.rebuildFromAgents(w);
    culture.step(w, p, grid, rng);
  }
  return meanKnowledge(w);
}

describe('culture ratchet — longevity is non-linear in fidelity', () => {
  it('longevityFactor rises steeply around the threshold (≈0 below, ≈1 above)', () => {
    expect(longevityFactor(0)).toBeLessThan(0.05); // well below ⇒ gains decay away
    expect(longevityFactor(1)).toBeGreaterThan(0.95); // well above ⇒ gains persist
    expect(longevityFactor(FIDELITY_THRESHOLD)).toBeCloseTo(0.5, 5); // midpoint
    // Steep (non-linear) around the threshold: the rise just across it dwarfs the
    // rise across an equally wide band far below it.
    const nearStep =
      longevityFactor(FIDELITY_THRESHOLD + 0.1) - longevityFactor(FIDELITY_THRESHOLD - 0.1);
    const farStep = longevityFactor(0.2) - longevityFactor(0.0);
    expect(nearStep).toBeGreaterThan(farStep * 3);
  });
});

describe('culture ratchet — conditional accumulation', () => {
  it('above the fidelity threshold knowledge ratchets above the seed; below it, it does not', () => {
    const seed = 0.3; // pure copying could never exceed this — only innovation can
    const aboveP = params({
      culture: true,
      transmissionFidelity: 0.95,
      knowledgeDecay: 0.01,
    });
    const belowP = params({
      culture: true,
      transmissionFidelity: 0.05,
      knowledgeDecay: 0.01,
    });
    const above = runCluster(aboveP, seed, 200);
    const below = runCluster(belowP, seed, 200);

    // Above threshold: innovation persists and accumulates to a *higher* level than
    // the seed (which copy-only could never exceed) — the ratchet.
    expect(above).toBeGreaterThan(seed + 5 * INNOVATION_INCREMENT);
    // Below threshold: no cumulative gain — decay dominates and knowledge falls far
    // below the seed, toward zero (the ratchet is conditional, not automatic).
    expect(below).toBeLessThan(seed * 0.5);
    expect(above).toBeGreaterThan(below);
  });

  it('accumulated knowledge rises with fidelity (markedly non-linear)', () => {
    const seed = 0.3;
    const p = (f: number): SimulationParameters =>
      params({ culture: true, transmissionFidelity: f, knowledgeDecay: 0.01 });
    const low = runCluster(p(0.2), seed, 200); // below threshold
    const mid = runCluster(p(0.55), seed, 200); // just above threshold
    const high = runCluster(p(0.95), seed, 200); // well above threshold
    // Steeply increasing in fidelity: a tiny held level below threshold, a much
    // higher held level above it.
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
    // The jump across the threshold (low→mid) is large relative to the seed.
    expect(mid - low).toBeGreaterThan(seed);
  });
});

describe('culture ratchet — bounded over a long run', () => {
  it('knowledge stays within [0, KNOWLEDGE_MAX] across a long, high-fidelity run', () => {
    const p = params({ culture: true, transmissionFidelity: 1, knowledgeDecay: 0 });
    const w = seededCluster(40, 2, 0.5);
    const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
    const culture = new Culture(w.agentCapacity);
    const rng = new Rng(3);
    for (let t = 0; t < 4000; t++) {
      grid.rebuildFromAgents(w);
      culture.step(w, p, grid, rng);
      // Never exceeds the ceiling at any tick, despite innovation and no decay.
      for (let s = 0; s < w.agentCapacity; s++) {
        if (w.alive[s] === 1) {
          expect(w.knowledge[s]).toBeLessThanOrEqual(KNOWLEDGE_MAX + 1e-6);
          expect(w.knowledge[s]).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('culture ratchet — determinism and default-off', () => {
  it('reproduces a full run exactly with the ratchet (culture on)', () => {
    const p = params({
      culture: true,
      transmissionFidelity: 0.9,
      knowledgeForagingGain: 0.8,
      knowledgeDecay: 0.01,
      initialPopulation: 140,
      foodAbundance: 260,
      worldWidth: 240,
      worldHeight: 240,
      seed: 11,
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

  it('the ratchet is inert with culture off (no knowledge advanced, run reproducible)', () => {
    const p = params({ initialPopulation: 120, foodAbundance: 220, seed: 5 });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(300);
      return { population: sim.world.population, x: Array.from(sim.world.x) };
    };
    expect(run()).toEqual(run());
    const sim = createSimulation(p);
    sim.run(300);
    expect(meanKnowledge(sim.world)).toBe(0); // no knowledge ever advanced
  });
});
