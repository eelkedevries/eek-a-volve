/**
 * Evolutionary-rescue / reversibility metric (observational only, v0.7.4).
 *
 * Surfaces the collapse-and-recovery "U-shape" already produced by the core's
 * existing mechanisms (near-extinction, standing variation, immigration, survivable
 * catastrophes, the food carrying capacity) so it can be *measured* — it adds no new
 * simulation rule. A rescue is a population trajectory that drops to a deep trough
 * and then climbs back: the metric records the trough depth and its tick, the
 * pre-trough baseline (a running high-water mark), and the recovery time to a target
 * fraction of that baseline.
 *
 * It is derived purely from the per-tick population count that the loop already
 * computes (`world.population`), draws **no** RNG, allocates nothing on the per-tick
 * path, and is never read back into a simulation decision — so determinism and the
 * default run are untouched (the same observational discipline as lineage and
 * records).
 */

/** Default recovery target: a trough "recovers" once it regains this fraction of the
 *  pre-trough baseline. A modeller-chosen reporting threshold, not a simulation rule. */
export const DEFAULT_RECOVERY_FRACTION = 0.6;

/** A snapshot of the rescue metric, as exposed by `Simulation`. */
export interface RescueMetric {
  /** Highest population seen before the deepest trough (the pre-shock baseline). */
  readonly baseline: number;
  /** Deepest trough population seen so far (the minimum). */
  readonly troughPopulation: number;
  /** Tick at which the deepest trough occurred (-1 before any tick is observed). */
  readonly troughTick: number;
  /** Whether the population has recovered to the target fraction of the baseline
   *  after the deepest trough. */
  readonly recovered: boolean;
  /** Ticks from the deepest trough to recovery (-1 if not yet recovered). */
  readonly recoveryTime: number;
}

/**
 * A tiny allocation-free accumulator the loop feeds one population value per tick.
 * It keeps only scalars, so updating it costs nothing on the hot path and it never
 * grows. The "baseline" is the running peak before the current deepest trough; the
 * trough is the minimum seen since; recovery is the first tick after the trough at
 * which the population climbs back to `recoveryFraction × baseline`.
 *
 * A fresh, deeper trough re-arms recovery (so a later, larger collapse is tracked),
 * and the baseline keeps rising with new peaks, so the metric stays meaningful over a
 * long run with repeated shocks.
 */
export class RescueTracker {
  private readonly recoveryFraction: number;
  private peak = 0;
  private baselineAtTrough = 0;
  private trough = Infinity;
  private troughAt = -1;
  private recoveredAt = -1;
  private observed = false;

  constructor(recoveryFraction: number = DEFAULT_RECOVERY_FRACTION) {
    this.recoveryFraction = recoveryFraction;
  }

  /**
   * Record one tick's population (already computed by the loop). Pure scalar work,
   * no allocation. `tick` is the tick the value belongs to.
   */
  observe(population: number, tick: number): void {
    this.observed = true;
    // Track the running high-water mark — the baseline a later trough is measured
    // against.
    if (population > this.peak) this.peak = population;
    // A new, deeper trough resets the recovery clock and freezes the baseline that
    // this trough is measured against (the peak reached before it).
    if (population < this.trough) {
      this.trough = population;
      this.troughAt = tick;
      this.baselineAtTrough = this.peak;
      this.recoveredAt = -1;
    } else if (
      this.recoveredAt === -1 &&
      this.troughAt !== -1 &&
      tick > this.troughAt &&
      this.baselineAtTrough > 0 &&
      population >= this.baselineAtTrough * this.recoveryFraction
    ) {
      // First climb back to the recovery target after the deepest trough.
      this.recoveredAt = tick;
    }
  }

  /** Read the current metric (a fresh small object; off the hot path). */
  snapshot(): RescueMetric {
    return {
      baseline: this.observed ? this.baselineAtTrough : 0,
      troughPopulation: this.observed ? this.trough : 0,
      troughTick: this.troughAt,
      recovered: this.recoveredAt !== -1,
      recoveryTime: this.recoveredAt === -1 ? -1 : this.recoveredAt - this.troughAt,
    };
  }
}

/**
 * Pure helper: compute the rescue metric over an explicit per-tick population series
 * (index = tick). Equivalent to feeding each value to a {@link RescueTracker} in
 * order; provided so the metric can be checked directly on a known
 * collapse-and-recovery trajectory. Observational only.
 */
export function rescueMetric(
  series: readonly number[],
  recoveryFraction: number = DEFAULT_RECOVERY_FRACTION,
): RescueMetric {
  const tracker = new RescueTracker(recoveryFraction);
  for (let t = 0; t < series.length; t++) tracker.observe(series[t], t);
  return tracker.snapshot();
}
