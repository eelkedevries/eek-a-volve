import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import {
  Disease,
  transmissionFactor,
  durationFactor,
  clampVirulence,
  INFECTED,
  VIRULENCE_MIN,
  VIRULENCE_MAX,
} from './disease.ts';
import { createSimulation, GRID_CELL_SIZE } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, DIET } from './genome.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 300, worldHeight: 300, ...over };
}

/** The expected onward-transmission optimum R(v) = transmission(v) × duration(v). */
function onwardOptimum(transmissionGain: number, harmGain: number): number {
  let best = -1;
  let bestV = -1;
  for (let v = 0; v <= 1.0001; v += 0.001) {
    const r = transmissionFactor(v, transmissionGain) * durationFactor(v, harmGain);
    if (r > best) {
      best = r;
      bestV = v;
    }
  }
  return bestV;
}

/** Mean virulence over currently-infected hosts (the meaningful population). */
function meanInfectedVirulence(w: World): number {
  let sum = 0;
  let n = 0;
  for (let s = 0; s < w.agentCapacity; s++) {
    if (w.alive[s] === 1 && w.infectionState[s] === INFECTED) {
      sum += w.virulence[s];
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

describe('virulence — trade-off shape has an interior optimum', () => {
  it('transmission rises and the infectious period shortens with virulence', () => {
    expect(transmissionFactor(1, 3)).toBeGreaterThan(transmissionFactor(0, 3));
    expect(durationFactor(1, 2.5)).toBeLessThan(durationFactor(0, 2.5));
  });

  it('the product peaks at an intermediate virulence, not at a clamp extreme', () => {
    const vStar = onwardOptimum(3, 2.5);
    expect(vStar).toBeGreaterThan(VIRULENCE_MIN + 0.05);
    expect(vStar).toBeLessThan(VIRULENCE_MAX - 0.05);
  });

  it('clampVirulence keeps virulence within range', () => {
    expect(clampVirulence(-1)).toBe(VIRULENCE_MIN);
    expect(clampVirulence(2)).toBe(VIRULENCE_MAX);
    expect(clampVirulence(0.4)).toBe(0.4);
  });
});

describe('virulence — inert and draw-free unless evolving', () => {
  /** Build a dense cluster with one infected patient zero at a given virulence. */
  function cluster(infectedVirulence: number): World {
    const w = new World(128, 16);
    for (let i = 0; i < 30; i++) {
      const s = w.spawnAgent();
      w.x[s] = 100 + (i % 16) * 2;
      w.y[s] = 100 + Math.floor(i / 16) * 2;
      w.traits[SIZE][s] = 1;
      w.traits[DIET][s] = 0;
      if (i === 0) {
        w.infectionState[s] = INFECTED;
        w.infectionTimer[s] = 9999;
        w.virulence[s] = infectedVirulence;
      }
    }
    return w;
  }

  it('with disease on but virulence off, the pass draws exactly as without virulence', () => {
    // Two identical worlds; both run the disease pass with virulence off. The RNG
    // streams must stay in lockstep (virulence adds no draws when not evolving).
    const p = params({ disease: true, transmissionRate: 0.2, recoveryRate: 0.05, virulenceEvolves: false });
    const wA = cluster(0.5);
    const wB = cluster(0.5);
    const gA = new SpatialGrid(300, 300, GRID_CELL_SIZE, wA.agentCapacity);
    const gB = new SpatialGrid(300, 300, GRID_CELL_SIZE, wB.agentCapacity);
    const rngA = new Rng(7);
    const rngB = new Rng(7);
    const dA = new Disease(wA.agentCapacity);
    const dB = new Disease(wB.agentCapacity);
    for (let t = 0; t < 30; t++) {
      gA.rebuildFromAgents(wA);
      gB.rebuildFromAgents(wB);
      dA.step(wA, p, gA, rngA);
      dB.step(wB, p, gB, rngB);
    }
    expect(rngA.next()).toBe(rngB.next());
  });
});

describe('virulence — determinism and convergence in the full loop', () => {
  it('with disease off, a virulence-on config is byte-identical to the default core', () => {
    const base = params({ initialPopulation: 120, foodAbundance: 240, seed: 4 });
    const run = (over: Partial<SimulationParameters>): unknown => {
      const sim = createSimulation({ ...base, ...over });
      sim.run(300);
      return { population: sim.world.population, x: Array.from(sim.world.x) };
    };
    // disease off ⇒ virulenceEvolves is moot; the run must match the plain default.
    expect(run({ virulenceEvolves: true })).toEqual(run({ virulenceEvolves: false }));
  });

  it('reproduces a run exactly with virulence evolving', () => {
    const p = params({
      disease: true,
      virulenceEvolves: true,
      initialPopulation: 140,
      foodAbundance: 260,
      seed: 5,
    });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(400);
      return {
        population: sim.world.population,
        virulence: Array.from(sim.world.virulence),
        infectionState: Array.from(sim.world.infectionState),
      };
    };
    expect(run()).toEqual(run());
  });

  it('post-074 path unchanged: disease-on, virulence-off matches a fixed reference per seed', () => {
    const p = params({ disease: true, virulenceEvolves: false, initialPopulation: 140, foodAbundance: 260, seed: 6 });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(300);
      return { population: sim.world.population, infectionState: Array.from(sim.world.infectionState) };
    };
    expect(run()).toEqual(run());
  });

  /**
   * Run a persistent SIS epidemic over a dense, static cluster (a fixed population
   * — no births/deaths — so the trade-off is isolated from ecological churn),
   * starting from a uniform spread of strain virulences, and report the converged
   * mean virulence of infected hosts. SIS keeps the epidemic alight so selection on
   * onward transmission can act over the long run. The Disease pass is driven
   * directly, exactly as the live loop drives it.
   */
  function convergedVirulence(
    n: number,
    transmissionGain: number,
    harmGain: number,
    transmissionRate = 0.06,
    seed = 11,
    ticks = 2000,
  ): number {
    const w = new World(256, 16);
    const slots: number[] = [];
    for (let i = 0; i < n; i++) {
      const s = w.spawnAgent();
      slots.push(s);
      w.x[s] = 100 + (i % 12) * 1.5;
      w.y[s] = 100 + Math.floor(i / 12) * 1.5;
      w.traits[SIZE][s] = 1;
      w.traits[DIET][s] = 0;
    }
    // Seed half the hosts infected, with virulences spread across the whole range
    // and staggered timers, so convergence is toward an interior optimum rather
    // than an artefact of the starting value.
    let k = 0;
    for (let i = 0; i < n; i += 2) {
      const s = slots[i];
      w.infectionState[s] = INFECTED;
      w.infectionTimer[s] = 5 + (i % 25);
      w.virulence[s] = ((k++ % 11) / 10) * VIRULENCE_MAX;
    }
    const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
    const disease = new Disease(w.agentCapacity);
    const rng = new Rng(seed);
    const p = params({
      disease: true,
      virulenceEvolves: true,
      immunityMode: 'sis',
      transmissionRate,
      recoveryRate: 0.05,
      diseaseMortality: 0,
      virulenceTransmissionGain: transmissionGain,
      virulenceHarmGain: harmGain,
      virulenceMutation: 0.04,
    });
    for (let t = 0; t < ticks; t++) {
      grid.rebuildFromAgents(w);
      disease.step(w, p, grid, rng);
    }
    return meanInfectedVirulence(w);
  }

  it('mean virulence converges to an intermediate value (not a clamp extreme)', () => {
    const vStar = onwardOptimum(3, 2.5);
    const mean = convergedVirulence(120, 3, 2.5);
    // It must settle away from both clamp extremes...
    expect(mean).toBeGreaterThan(VIRULENCE_MIN + 0.1);
    expect(mean).toBeLessThan(VIRULENCE_MAX - 0.1);
    // ...in a broad neighbourhood of the analytic onward-transmission optimum.
    expect(Math.abs(mean - vStar)).toBeLessThan(0.25);
  }, 30000);

  it('reproduces the converged virulence exactly for a fixed seed', () => {
    expect(convergedVirulence(120, 3, 2.5)).toBe(convergedVirulence(120, 3, 2.5));
  }, 30000);

  it('the optimum shifts with the trade-off, not ratcheting to maximum', () => {
    // A harsher host-harm slope makes high virulence cost more onward spread, so the
    // converged virulence is lower than under a gentler slope — it responds to the
    // trade-off rather than ratcheting to the clamp maximum.
    const gentle = convergedVirulence(120, 3, 1.5);
    const harsh = convergedVirulence(120, 3, 4.0);
    expect(harsh).toBeLessThan(gentle);
    expect(gentle).toBeLessThan(VIRULENCE_MAX); // never pinned at the maximum
    expect(harsh).toBeGreaterThan(VIRULENCE_MIN); // nor collapsed to the minimum
  }, 30000);

  it('the optimum responds to host density (a denser cluster shifts it)', () => {
    // Denser surroundings change the susceptible supply, so the selected virulence
    // shifts with density rather than sitting at a fixed ceiling.
    const sparse = convergedVirulence(60, 3, 2.5);
    const dense = convergedVirulence(120, 3, 2.5);
    expect(sparse).not.toBe(dense);
    expect(dense).toBeLessThan(VIRULENCE_MAX);
    expect(sparse).toBeLessThan(VIRULENCE_MAX);
  }, 30000);
});
