import { describe, it, expect } from 'vitest';
import { createSimulation, type Simulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { NEAR_EXTINCTION_THRESHOLD } from './bounds.ts';
import { rescueMetric, RescueTracker } from './rescue.ts';

/**
 * Evolutionary rescue (the collapse-and-recovery "U-shape"), and the observational
 * rescue metric that measures it (v0.7.4). The mechanisms are all pre-existing:
 * standing variation, immigration, the food carrying capacity, and survivable shocks.
 * A rescue is a deep population trough followed by recovery toward the pre-shock
 * level; recovery is **conditional** on standing variation and population size, not
 * forced — a deep bottleneck in a regime where survivors cannot reproduce simply does
 * not recover.
 *
 * The metric is derived only from the per-tick population the loop already computes;
 * it adds no RNG and is never read back into a decision, so the default run and
 * determinism are untouched (asserted elsewhere by the inertness/stability tests).
 */

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 260, worldHeight: 260, ...over };
}

/** Keep only the first `survivors` live agents, killing the rest (a bottleneck). */
function bottleneck(sim: Simulation, survivors: number): void {
  let live = 0;
  for (let s = 0; s < sim.world.agentCapacity; s++) {
    if (sim.world.alive[s] === 1) {
      live++;
      if (live > survivors) sim.world.killAgent(s);
    }
  }
}

/** Stabilise a run, apply a bottleneck, then record the per-tick population series
 *  (prefixed with the pre-shock level so the metric's baseline is that level). */
function shockAndRecord(
  over: Partial<SimulationParameters>,
  survivors: number,
  burnIn: number,
  recordTicks: number,
): { preShock: number; series: number[] } {
  const sim = createSimulation(params(over));
  sim.run(burnIn);
  const preShock = sim.world.population;
  bottleneck(sim, survivors);
  const series = [preShock];
  for (let t = 0; t < recordTicks; t++) {
    sim.step();
    series.push(sim.world.population);
  }
  return { preShock, series };
}

describe('rescue metric — reads a known collapse-and-recovery trajectory', () => {
  it('reports trough depth/time and recovery time on an explicit U-shaped series', () => {
    // A hand-made U: peak 100, crash to 8 at tick 4, climb back. With a 0.6 recovery
    // target it recovers at the first sample >= 60 (tick 8).
    const series = [100, 100, 80, 40, 8, 8, 20, 55, 70, 90];
    const m = rescueMetric(series, 0.6);
    expect(m.baseline).toBe(100);
    expect(m.troughPopulation).toBe(8);
    expect(m.troughTick).toBe(4);
    expect(m.recovered).toBe(true);
    expect(m.recoveryTime).toBe(4); // tick 8 minus trough tick 4
  });

  it('reports no recovery when the series never climbs back to the target', () => {
    const series = [100, 90, 50, 20, 10, 10, 12, 14, 15]; // stuck low after the crash
    const m = rescueMetric(series, 0.6);
    expect(m.troughPopulation).toBe(10);
    expect(m.recovered).toBe(false);
    expect(m.recoveryTime).toBe(-1);
  });

  it('the tracker and the helper agree (same per-tick values)', () => {
    const series = [50, 60, 40, 10, 5, 9, 25, 33, 40];
    const tracker = new RescueTracker(0.6);
    for (let t = 0; t < series.length; t++) tracker.observe(series[t], t);
    expect(tracker.snapshot()).toEqual(rescueMetric(series, 0.6));
  });
});

describe('evolutionary rescue — a U-shape under a survivable shock', () => {
  it('drops to a deep trough then recovers, reproducibly per seed', () => {
    // Stabilise at carrying capacity, crash to a handful of survivors (a deep, near-
    // extinction-floor trough), then recover via reproduction and immigration
    // (standing variation). Asexual budding lets the survivors reproduce, so this
    // regime is survivable — but the depth is real, not tuning away the collapse.
    for (const seed of [3, 7]) {
      const over = {
        seed,
        initialPopulation: 200,
        foodAbundance: 240,
        foodRegenRate: 3,
        immigration: true,
        predation: true,
      };
      const a = shockAndRecord(over, 12, 800, 3000);
      const b = shockAndRecord(over, 12, 800, 3000);
      // Reproducible per seed: identical trajectories.
      expect(a.series).toEqual(b.series);

      const m = rescueMetric(a.series, 0.5);
      // A genuinely deep trough (down to the bottleneck survivors, near the floor).
      expect(m.troughPopulation).toBeLessThan(a.preShock * 0.2);
      expect(m.troughPopulation).toBeLessThanOrEqual(20);
      // The U closes: the population climbs back to at least half the pre-shock level.
      expect(m.recovered).toBe(true);
      expect(m.recoveryTime).toBeGreaterThan(0);
      // The trough genuinely approached the near-extinction regime (a real collapse).
      expect(m.troughPopulation).toBeGreaterThan(0); // survivable, not extinction here
    }
  }, 30000);

  it('recovery is conditional, not forced: a deep bottleneck that cannot reproduce does not recover', () => {
    // The same deep shock in sexual mode with no immigration: a tiny isolated group
    // cannot find compatible mates, so it fails to recover — evidence that rescue
    // depends on standing variation and population size rather than being guaranteed.
    let anyFailed = false;
    for (const seed of [1, 2, 3, 4]) {
      const { series } = shockAndRecord(
        {
          seed,
          initialPopulation: 200,
          foodAbundance: 240,
          foodRegenRate: 3,
          immigration: false,
          predation: true,
          sexualReproduction: true,
        },
        2,
        800,
        2000,
      );
      const m = rescueMetric(series, 0.5);
      if (!m.recovered) anyFailed = true;
    }
    expect(anyFailed).toBe(true); // recovery is not automatic
  }, 30000);

  it('the live Simulation.rescue getter tracks the deepest trough seen', () => {
    // The getter accumulates from tick 0; after a deep bottleneck the deepest trough
    // it reports must be at or below the near-extinction threshold region we forced.
    const sim = createSimulation(
      params({ seed: 5, initialPopulation: 200, foodAbundance: 240, foodRegenRate: 3, immigration: true }),
    );
    sim.run(800);
    bottleneck(sim, 8);
    sim.run(1500);
    const m = sim.rescue;
    expect(m.troughPopulation).toBeLessThanOrEqual(8);
    expect(m.troughTick).toBeGreaterThanOrEqual(0);
    // After recovery the live population is well above the trough and the floor.
    expect(sim.world.population).toBeGreaterThan(NEAR_EXTINCTION_THRESHOLD);
  }, 30000);
});
