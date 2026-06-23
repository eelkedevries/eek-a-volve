import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import type { Rng } from './rng.ts';

/**
 * Transitions / complexity state — a [design-abstraction] / [speculative] capacity
 * (specification: Domain rules → Transitions / complexity). **Detection at a designed
 * threshold, never emergence**, and **reversible / non-absorbing by construction**: an
 * explicit degradation hazard guarantees that a region which enters the state can also
 * leave it (and later re-enter).
 *
 * The detector reads only quantities that already exist — local population density
 * (from the agent positions) and local mean `knowledge` (the 080 culture column) — over
 * a coarse, fixed tiling of the world. A region enters the "complexity" state when both
 * stay above their cutoffs for a sustained window. While active it raises local food
 * regeneration (a stand-in for technology raising carrying capacity), but a degradation
 * accumulator rises with sustained activity and *reduces* local regeneration, so the
 * region overshoots its raised capacity and declines; when degradation crosses an exit
 * hazard the region leaves the state and degradation recovers, after which it may
 * re-enter. The local food effect is applied by {@link regionRegenMultiplier} from the
 * food-regeneration pass.
 *
 * Pre-allocated per-region scalars, so the per-tick path allocates nothing (in the
 * style of {@link Disease}/{@link Culture}). It draws the run's seeded RNG **only** when
 * `params.transitions` is on (a small bounded degradation jitter per active region);
 * with the toggle off no region state is computed, no RNG is drawn, and food
 * regeneration is unaltered, so the default run is byte-for-byte unchanged.
 */

/** Coarse region tiling: the world is split into REGION_COLS × REGION_ROWS tiles. A
 *  fixed structural constant (the tunable thresholds/rates live in params). */
export const REGION_COLS = 6;
export const REGION_ROWS = 6;
export const REGION_COUNT = REGION_COLS * REGION_ROWS;

/** Smallest effective regeneration multiplier (a degraded region never goes fully
 *  barren, so recovery — and reversibility — is always reachable). */
export const MIN_REGEN_MULTIPLIER = 0.15;

/** Amplitude of the bounded seeded degradation jitter per active region (the only RNG
 *  this pass draws, taken solely when `transitions` is on). Keeps exit timing varied
 *  across regions/seeds without ever reversing the net degradation trend. */
export const DEGRADATION_JITTER = 0.006;

/** Per-region snapshot for tests/inspection (not on the hot path). */
export interface RegionState {
  readonly active: boolean;
  readonly density: number;
  readonly meanKnowledge: number;
  readonly degradation: number;
  readonly sustained: number;
}

export class Transitions {
  private readonly regionWidth: number;
  private readonly regionHeight: number;

  // Pre-allocated per-region scalars (no per-tick allocation).
  /** Live agents counted in each region this tick. */
  private readonly density = new Int32Array(REGION_COUNT);
  /** Mean knowledge of the agents in each region this tick. */
  private readonly meanKnowledge = new Float32Array(REGION_COUNT);
  /** Consecutive ticks a region has stayed above both cutoffs (the sustained window). */
  private readonly sustained = new Int32Array(REGION_COUNT);
  /** Whether each region is currently in the complexity state. */
  private readonly active = new Uint8Array(REGION_COUNT);
  /** Environmental degradation accumulator per region. */
  private readonly degradation = new Float32Array(REGION_COUNT);
  /** Effective per-region regeneration multiplier consulted by the food pass. */
  private readonly regenMultiplier = new Float32Array(REGION_COUNT);
  /** Scratch knowledge sums (reset each tick). */
  private readonly knowledgeSum = new Float32Array(REGION_COUNT);

  constructor(worldWidth: number, worldHeight: number) {
    this.regionWidth = worldWidth / REGION_COLS;
    this.regionHeight = worldHeight / REGION_ROWS;
    this.regenMultiplier.fill(1);
  }

  /** Region index for a world position (clamped to the tiling). */
  private regionOf(x: number, y: number): number {
    let cx = Math.floor(x / this.regionWidth);
    let cy = Math.floor(y / this.regionHeight);
    if (cx < 0) cx = 0;
    else if (cx >= REGION_COLS) cx = REGION_COLS - 1;
    if (cy < 0) cy = 0;
    else if (cy >= REGION_ROWS) cy = REGION_ROWS - 1;
    return cy * REGION_COLS + cx;
  }

  /**
   * The local food-regeneration multiplier at a world position: 1 where no complexity
   * state has formed, > 1 in an active, not-yet-degraded region (technology), and well
   * below 1 in a degraded region (overshoot → local decline). Always ≥
   * {@link MIN_REGEN_MULTIPLIER}. Consulted by `regenerateFood` (transitions on only).
   */
  regionRegenMultiplier(x: number, y: number): number {
    return this.regenMultiplier[this.regionOf(x, y)];
  }

  /** Snapshot of one region's state (for tests; allocates, off the hot path). */
  regionState(region: number): RegionState {
    return {
      active: this.active[region] === 1,
      density: this.density[region],
      meanKnowledge: this.meanKnowledge[region],
      degradation: this.degradation[region],
      sustained: this.sustained[region],
    };
  }

  /** Number of regions currently in the complexity state. */
  activeRegionCount(): number {
    let n = 0;
    for (let r = 0; r < REGION_COUNT; r++) n += this.active[r];
    return n;
  }

  /**
   * Advance the per-region detector and two-phase local effect by one tick. Draws the
   * seeded RNG only here, and only when `params.transitions` is on. Does nothing (no
   * state, no RNG) when the toggle is off, so the default run is unchanged.
   */
  step(world: World, params: SimulationParameters, rng: Rng): void {
    if (!params.transitions) return;
    const { alive, knowledge, x, y, agentCapacity } = world;
    const density = this.density;
    const knowledgeSum = this.knowledgeSum;
    density.fill(0);
    knowledgeSum.fill(0);

    // 1. Tally density and knowledge per region in a single pass over live agents.
    for (let s = 0; s < agentCapacity; s++) {
      if (alive[s] === 0) continue;
      const r = this.regionOf(x[s], y[s]);
      density[r]++;
      knowledgeSum[r] += knowledge[s];
    }

    const densityCut = params.transitionDensity;
    const knowledgeCut = params.transitionKnowledge;
    const window = params.transitionWindow;
    const technologyGain = params.transitionTechnologyGain;
    const degradationRate = params.transitionDegradationRate;
    const recoveryRate = params.transitionRecoveryRate;
    const degradationExit = params.transitionDegradationExit;

    // 2. Per-region detection and the reversible two-phase effect.
    for (let r = 0; r < REGION_COUNT; r++) {
      const d = density[r];
      const mk = d > 0 ? knowledgeSum[r] / d : 0;
      this.meanKnowledge[r] = mk;

      const aboveThreshold = d >= densityCut && mk >= knowledgeCut;
      if (aboveThreshold) {
        if (this.sustained[r] < window) this.sustained[r]++;
      } else {
        this.sustained[r] = 0;
      }

      if (this.active[r] === 1) {
        // Active phase: degrade (with a small seeded jitter, the only RNG here), and
        // exit when degradation crosses the hazard, or when the region drops below the
        // sustaining conditions. Both keep the state non-absorbing.
        const jitter = (rng.next() * 2 - 1) * DEGRADATION_JITTER;
        let deg = this.degradation[r] + degradationRate + jitter;
        if (deg < 0) deg = 0;
        this.degradation[r] = deg;
        if (deg >= degradationExit || !aboveThreshold) {
          this.active[r] = 0;
          this.sustained[r] = 0;
        }
      } else {
        // Inactive phase: the land heals (degradation recovers toward zero), and the
        // region (re-)enters the state once the sustained window is met.
        let deg = this.degradation[r] - recoveryRate;
        if (deg < 0) deg = 0;
        this.degradation[r] = deg;
        if (this.sustained[r] >= window) {
          this.active[r] = 1;
        }
      }

      // Effective regeneration multiplier: a technology boost while active, eroded
      // (and pushed below baseline) by accumulated degradation; baseline 1 when neither
      // active nor degraded. Floored so a region is never fully barren (reversibility).
      let mult: number;
      if (this.active[r] === 1) {
        mult = 1 + technologyGain - this.degradation[r];
      } else {
        // A recently-collapsed region stays suppressed until its degradation heals.
        mult = 1 - this.degradation[r];
      }
      if (mult < MIN_REGEN_MULTIPLIER) mult = MIN_REGEN_MULTIPLIER;
      this.regenMultiplier[r] = mult;
    }
  }
}
