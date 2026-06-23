import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import { Culture, KNOWLEDGE_MAX } from './culture.ts';
import { EventLog } from './eventlog.ts';
import { createSimulation, GRID_CELL_SIZE } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, DIET } from './genome.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 300, worldHeight: 300, ...over };
}

/** Place `n` herbivores tightly clustered (all within the copy radius of each other). */
function fillCluster(w: World, n: number, spacing: number, knowledge: number): void {
  for (let i = 0; i < n; i++) {
    const s = w.spawnAgent();
    w.x[s] = 100 + (i % 16) * spacing;
    w.y[s] = 100 + Math.floor(i / 16) * spacing;
    w.traits[SIZE][s] = 1;
    w.traits[DIET][s] = 0;
    w.knowledge[s] = knowledge;
  }
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

describe('cultural loss — U-shaped, reversible loss below a critical reachable population', () => {
  it('builds, loses below critical N, then recovers when the population rebounds', () => {
    // High fidelity so culture accumulates while the group is dense; a critical N
    // that a thinned group falls below. The same dense ecology drives the U-shape.
    const p = params({
      culture: true,
      transmissionFidelity: 0.95,
      knowledgeDecay: 0.02,
      criticalCultureN: 10,
    });
    const w = new World(256, 16);
    const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
    const culture = new Culture(w.agentCapacity);
    const rng = new Rng(7);
    const tick = (ticks: number): void => {
      for (let t = 0; t < ticks; t++) {
        grid.rebuildFromAgents(w);
        culture.step(w, p, grid, rng);
      }
    };

    // Phase 1 — dense population: each agent reaches many models (≫ critical N), so
    // copying sustains/builds knowledge.
    fillCluster(w, 40, 2, 0.2);
    tick(150);
    const built = meanKnowledge(w);
    expect(built).toBeGreaterThan(0.2); // culture accumulated

    // Phase 2 — bottleneck: kill most of the population so each survivor can reach
    // only a few models (< critical N). Maintenance throttles, decay wins.
    let killed = 0;
    for (let s = 0; s < w.agentCapacity && killed < 36; s++) {
      if (w.alive[s] === 1) {
        w.killAgent(s);
        killed++;
      }
    }
    expect(w.population).toBeLessThan(10); // sub-critical reachable pool
    tick(150);
    const afterLoss = meanKnowledge(w);
    expect(afterLoss).toBeLessThan(built * 0.5); // mean knowledge fell markedly

    // Phase 3 — rebound: repopulate the cluster (fresh slots start at 0 knowledge,
    // but enough models are again reachable). Knowledge recovers — no permanent
    // "dark age", the loss is reversible.
    fillCluster(w, 36, 2, 0);
    tick(250);
    const recovered = meanKnowledge(w);
    expect(recovered).toBeGreaterThan(afterLoss); // it climbed back
    expect(w.population).toBeGreaterThan(10);
  });

  it('is reproducible per seed (the loss/recovery is deterministic)', () => {
    const p = params({
      culture: true,
      transmissionFidelity: 0.95,
      knowledgeDecay: 0.02,
      criticalCultureN: 10,
    });
    const sample = (): number[] => {
      const w = new World(256, 16);
      const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
      const culture = new Culture(w.agentCapacity);
      const rng = new Rng(3);
      const out: number[] = [];
      fillCluster(w, 40, 2, 0.2);
      for (let t = 0; t < 100; t++) {
        grid.rebuildFromAgents(w);
        culture.step(w, p, grid, rng);
      }
      out.push(meanKnowledge(w));
      // bottleneck
      let killed = 0;
      for (let s = 0; s < w.agentCapacity && killed < 36; s++) {
        if (w.alive[s] === 1) { w.killAgent(s); killed++; }
      }
      for (let t = 0; t < 100; t++) {
        grid.rebuildFromAgents(w);
        culture.step(w, p, grid, rng);
      }
      out.push(meanKnowledge(w));
      return out;
    };
    expect(sample()).toEqual(sample());
  });
});

describe('cultural loss — the "knowledge lost" event', () => {
  it('raises a cultureLoss event when knowledge collapses under a sub-critical population', () => {
    // Build culture in a dense run, then crash the population hard. The loop must
    // surface a cultureLoss event during the decline.
    const p = params({
      culture: true,
      transmissionFidelity: 0.95,
      knowledgeForagingGain: 0.5,
      knowledgeDecay: 0.02,
      criticalCultureN: 20,
      catastrophes: false,
      predation: false,
      worldWidth: 160,
      worldHeight: 160,
      initialPopulation: 220,
      foodAbundance: 320,
      seed: 9,
    });
    const sim = createSimulation(p);
    // Build knowledge while dense.
    sim.run(400);
    const peak = meanKnowledge(sim.world);
    expect(peak).toBeGreaterThan(0.05); // culture really built up

    // Hard crash: kill ~90% of the population so the reachable model pool collapses.
    const survivors = Math.max(3, Math.floor(sim.world.population * 0.1));
    let live = 0;
    for (let s = 0; s < sim.world.agentCapacity; s++) {
      if (sim.world.alive[s] === 1) {
        live++;
        if (live > survivors) sim.world.killAgent(s);
      }
    }
    // Drain prior events so we only see what the decline raises.
    sim.eventLog.drain();
    let sawLoss = false;
    for (let t = 0; t < 400 && !sawLoss; t++) {
      sim.step();
      for (const e of sim.eventLog.drain()) if (e.kind === 'cultureLoss') sawLoss = true;
    }
    expect(sawLoss).toBe(true); // a "knowledge lost" moment surfaced
  }, 30000);

  it('EventLog.cultureLoss records a drainable cultureLoss event', () => {
    const log = new EventLog();
    log.setTick(42);
    log.cultureLoss();
    const drained = log.drain();
    expect(drained).toHaveLength(1);
    expect(drained[0].kind).toBe('cultureLoss');
    expect(drained[0].tick).toBe(42);
  });
});

describe('cultural loss — default-off and bounds', () => {
  it('is inert when culture is off (run reproducible, no knowledge advanced)', () => {
    const p = params({ initialPopulation: 120, foodAbundance: 220, seed: 5 });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(300);
      return { population: sim.world.population, x: Array.from(sim.world.x) };
    };
    expect(run()).toEqual(run());
    const sim = createSimulation(p);
    sim.run(300);
    expect(meanKnowledge(sim.world)).toBe(0);
  });

  it('criticalCultureN <= 0 disables the gate (knowledge maintained in a tiny group)', () => {
    // With the gate off, even a lone pair sustains/builds knowledge above threshold.
    const p = params({
      culture: true,
      transmissionFidelity: 0.95,
      knowledgeDecay: 0.02,
      criticalCultureN: 0,
    });
    const w = new World(16, 16);
    fillCluster(w, 2, 2, 0.2);
    const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
    const culture = new Culture(w.agentCapacity);
    const rng = new Rng(1);
    for (let t = 0; t < 150; t++) {
      grid.rebuildFromAgents(w);
      culture.step(w, p, grid, rng);
    }
    expect(meanKnowledge(w)).toBeGreaterThan(0.2); // not throttled despite tiny group
    expect(meanKnowledge(w)).toBeLessThanOrEqual(KNOWLEDGE_MAX + 1e-6);
  });
});
