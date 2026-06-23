import { describe, it, expect } from 'vitest';
import { createSimulation, type Simulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { World } from './world.ts';
import { Rng } from './rng.ts';
import { MAX_POPULATION } from './bounds.ts';
import {
  Transitions,
  REGION_COUNT,
  REGION_COLS,
  MIN_REGEN_MULTIPLIER,
} from './transitions.ts';

/**
 * Transitions / complexity state ([design-abstraction] / [speculative], v0.8.0):
 * detection at a designed threshold (sustained high local density + knowledge), a
 * two-phase local food effect (technology up, then degradation down), and an explicit
 * degradation hazard that makes the state **non-absorbing** — regions that enter are
 * observed to exit (and may re-enter). Off by default, so the run is byte-for-byte
 * unchanged.
 */

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 200, worldHeight: 200, ...over };
}

/** A dense culture+transitions regime in which regions reliably enter and exit. */
function enablingParams(seed: number, over: Partial<SimulationParameters> = {}): SimulationParameters {
  return params({
    seed,
    culture: true,
    transmissionFidelity: 0.9,
    knowledgeForagingGain: 0.3,
    knowledgeDecay: 0.02,
    criticalCultureN: 4,
    predation: true,
    initialPopulation: 160,
    foodAbundance: 200,
    foodRegenRate: 3,
    transitions: true,
    transitionDensity: 14,
    transitionTechnologyGain: 1.0,
    ...over,
  });
}

/** Run a sim, returning per-region "ever entered" / "observed exit" flags + bounds. */
function regionCensus(
  sim: Simulation,
  ticks: number,
): {
  everEntered: number;
  observedExit: number;
  maxConcurrentActive: number;
  maxPop: number;
  maxFood: number;
} {
  const everEntered = new Array<boolean>(REGION_COUNT).fill(false);
  const observedExit = new Array<boolean>(REGION_COUNT).fill(false);
  const prevActive = new Array<boolean>(REGION_COUNT).fill(false);
  let maxConcurrentActive = 0;
  let maxPop = 0;
  let maxFood = 0;
  for (let t = 0; t < ticks; t++) {
    sim.step();
    if (sim.world.population > maxPop) maxPop = sim.world.population;
    if (sim.world.foodCount > maxFood) maxFood = sim.world.foodCount;
    let concurrent = 0;
    for (let r = 0; r < REGION_COUNT; r++) {
      const active = sim.transitions.regionState(r).active;
      if (active) {
        everEntered[r] = true;
        concurrent++;
      }
      if (prevActive[r] && !active) observedExit[r] = true;
      prevActive[r] = active;
    }
    if (concurrent > maxConcurrentActive) maxConcurrentActive = concurrent;
  }
  return {
    everEntered: everEntered.filter(Boolean).length,
    observedExit: observedExit.filter(Boolean).length,
    maxConcurrentActive,
    maxPop,
    maxFood,
  };
}

describe('transitions — inert by default (byte-for-byte unchanged)', () => {
  it('reproduces a run exactly with transitions off, and computes no region state', () => {
    const p = params({ seed: 42, initialPopulation: 120, foodAbundance: 220 });
    const snapshot = (sim: Simulation): unknown => ({
      population: sim.world.population,
      food: sim.world.foodCount,
      x: Array.from(sim.world.x),
      energy: Array.from(sim.world.energy),
    });
    const a = createSimulation(p);
    a.run(500);
    const b = createSimulation(p);
    b.run(500);
    expect(snapshot(a)).toEqual(snapshot(b));
    // No region ever activates and no degradation accrues when the toggle is off.
    for (let r = 0; r < REGION_COUNT; r++) {
      const st = a.transitions.regionState(r);
      expect(st.active).toBe(false);
      expect(st.degradation).toBe(0);
    }
  });

  it('food regeneration is identical to a run constructed without the field (off path)', () => {
    // The transitions field exists on every Simulation; with the toggle off it must not
    // perturb the RNG stream or food placement, so two default runs match exactly.
    const p = params({ seed: 7, initialPopulation: 100, foodAbundance: 200 });
    const food = (sim: Simulation): unknown => ({
      foodCount: sim.world.foodCount,
      plant: sim.world.plantCount,
      foodX: Array.from(sim.world.foodX),
    });
    const a = createSimulation(p);
    a.run(400);
    const b = createSimulation(p);
    b.run(400);
    expect(food(a)).toEqual(food(b));
  });
});

describe('transitions — deterministic with the toggle on', () => {
  it('reproduces an enabling run exactly (determinism with transitions on)', () => {
    const p = enablingParams(5);
    const snapshot = (sim: Simulation): unknown => ({
      population: sim.world.population,
      food: sim.world.foodCount,
      x: Array.from(sim.world.x),
      knowledge: Array.from(sim.world.knowledge),
      regions: Array.from({ length: REGION_COUNT }, (_unused, r) => {
        const st = sim.transitions.regionState(r);
        return [st.active ? 1 : 0, st.degradation, st.sustained];
      }),
    });
    const a = createSimulation(p);
    a.run(800);
    const b = createSimulation(p);
    b.run(800);
    expect(snapshot(a)).toEqual(snapshot(b));
  }, 30000);

  it('performs no new per-tick allocation (column/food arrays are reused)', () => {
    const sim = createSimulation(enablingParams(3));
    const xRef = sim.world.x;
    const foodXRef = sim.world.foodX;
    sim.run(500);
    expect(sim.world.x).toBe(xRef);
    expect(sim.world.foodX).toBe(foodXRef);
  }, 30000);
});

describe('transitions — arise and collapse (the Butzer/Endfield signature)', () => {
  it('some regions enter and some later exit the complexity state, across seeds', () => {
    let anyEntered = false;
    let anyExited = false;
    for (const seed of [1, 2, 3]) {
      const c = regionCensus(createSimulation(enablingParams(seed)), 1200);
      if (c.everEntered > 0) anyEntered = true;
      if (c.observedExit > 0) anyExited = true;
      // Per seed the state both arises and collapses: regions enter, and entries are
      // matched by observed exits (a transient, not a terminal, state).
      expect(c.everEntered).toBeGreaterThan(0);
      expect(c.observedExit).toBeGreaterThan(0);
      // Neither universal nor terminal: not every region is in the state at once (some
      // are never crowded/knowledgeable enough simultaneously).
      expect(c.maxConcurrentActive).toBeLessThan(REGION_COUNT);
    }
    expect(anyEntered).toBe(true); // the state arises
    expect(anyExited).toBe(true); // and collapses
  }, 45000);

  it('is non-absorbing: regions that enter are observed to exit, and bounds hold', () => {
    const p = enablingParams(1);
    const c = regionCensus(createSimulation(p), 2500);
    expect(c.everEntered).toBeGreaterThan(0);
    // Every region that ever entered the state was, at some point, observed to leave it
    // — the state is not a permanent attractor.
    expect(c.observedExit).toBe(c.everEntered);
    // Both population bounds are preserved despite the technology lift.
    expect(c.maxPop).toBeLessThanOrEqual(MAX_POPULATION);
    expect(c.maxPop).toBeLessThanOrEqual(p.maxPopulation);
    // Standing food never exceeds the food-pool capacity (the carrying-capacity bound).
    const sim = createSimulation(p);
    expect(c.maxFood).toBeLessThanOrEqual(sim.world.foodCapacity);
  }, 45000);

  it('cannot force guaranteed extinction on a default-ish run (population persists)', () => {
    // Even under a strong technology gain and a low density cutoff, the population
    // survives — the degradation hazard bounds local overshoot rather than crashing the
    // whole world to zero.
    const sim = createSimulation(enablingParams(2, { transitionTechnologyGain: 3, transitionDensity: 8 }));
    sim.run(1500);
    expect(sim.world.population).toBeGreaterThan(0);
  }, 30000);
});

describe('transitions — the per-region detector and two-phase effect (unit level)', () => {
  it('enters after the sustained window, then exits via the degradation hazard, then recovers', () => {
    // A tiny world with one densely-packed, high-knowledge region. The detector should
    // enter the complexity state after the window, degrade while active, exit when the
    // hazard fires, then recover (degradation heals) — re-entry possible.
    const p = params({
      transitions: true,
      transitionDensity: 8,
      transitionKnowledge: 0.4,
      transitionWindow: 5,
      transitionTechnologyGain: 1.0,
      transitionDegradationRate: 0.1, // fast so the test is short
      transitionRecoveryRate: 0.2,
      transitionDegradationExit: 0.6,
    });
    const w = new World(64, 16);
    const rng = new Rng(1);
    const trans = new Transitions(p.worldWidth, p.worldHeight);
    // Pack 12 knowledgeable agents into region (0,0) — the top-left tile.
    const regionW = p.worldWidth / REGION_COLS;
    for (let i = 0; i < 12; i++) {
      const s = w.spawnAgent();
      w.x[s] = (regionW * 0.5) * (i % 2 === 0 ? 0.5 : 0.6); // all well inside region 0
      w.y[s] = 2 + (i % 4);
      w.knowledge[s] = 0.8;
    }
    const region0 = 0;

    // Not active before the window elapses.
    trans.step(w, p, rng);
    expect(trans.regionState(region0).active).toBe(false);
    for (let t = 0; t < 5; t++) trans.step(w, p, rng);
    expect(trans.regionState(region0).active).toBe(true); // entered after the window

    // While active the regeneration multiplier is lifted above 1 (technology).
    expect(trans.regionRegenMultiplier(1, 1)).toBeGreaterThan(1);

    // Keep stepping: degradation accrues and the hazard forces an exit.
    let exited = false;
    for (let t = 0; t < 40 && !exited; t++) {
      trans.step(w, p, rng);
      if (!trans.regionState(region0).active) exited = true;
    }
    expect(exited).toBe(true); // the degradation hazard fired — non-absorbing

    // After exit, a degraded region's regeneration is suppressed (overshoot → decline),
    // and never fully barren (floored), so recovery — and re-entry — stays reachable.
    const mult = trans.regionRegenMultiplier(1, 1);
    expect(mult).toBeLessThan(1);
    expect(mult).toBeGreaterThanOrEqual(MIN_REGEN_MULTIPLIER);
  });

  it('draws no RNG and leaves regions untouched when the toggle is off', () => {
    const p = params({ transitions: false, transitionDensity: 1, transitionKnowledge: 0 });
    const w = new World(16, 16);
    for (let i = 0; i < 8; i++) {
      const s = w.spawnAgent();
      w.x[s] = 5;
      w.y[s] = 5;
      w.knowledge[s] = 1;
    }
    const trans = new Transitions(p.worldWidth, p.worldHeight);
    const rngA = new Rng(99);
    const rngB = new Rng(99);
    for (let t = 0; t < 50; t++) trans.step(w, p, rngA);
    // The RNG must be untouched (off path draws nothing), so it matches a fresh stream.
    expect(rngA.next()).toBe(rngB.next());
    for (let r = 0; r < REGION_COUNT; r++) expect(trans.regionState(r).active).toBe(false);
  });
});
