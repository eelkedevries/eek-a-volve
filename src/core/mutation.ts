import type { Rng } from './rng.ts';
import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import { TRAIT_COUNT, TRAIT_RANGES, clampTrait } from './genome.ts';

/**
 * Probability that an offspring carries a freak mutation: an out-of-distribution
 * jump in one trait. Low, but legitimate variation, and flagged for display and
 * narration (specification: Domain rules → Events).
 */
export const FREAK_MUTATION_RATE = 0.001;

/**
 * Write the offspring genome into the `child` slot from the `parent` slot.
 *
 * Each trait is copied, then mutated with probability `mutationRate` by a
 * Gaussian step whose standard deviation is `mutationMagnitude` of the trait's
 * range width, then clamped to the trait's valid range. Rarely a freak mutation
 * re-samples one trait uniformly across its whole range. Reads and writes the
 * structure-of-arrays columns directly, so no per-offspring genome is allocated
 * (specification: Domain rules → Reproduction and mutation).
 *
 * Returns whether a freak mutation occurred.
 */
export function breed(
  world: World,
  child: number,
  parent: number,
  params: SimulationParameters,
  rng: Rng,
): boolean {
  const { mutationRate, mutationMagnitude } = params;
  const cols = world.traits;
  for (let t = 0; t < TRAIT_COUNT; t++) {
    let value = cols[t][parent];
    if (rng.next() < mutationRate) {
      const range = TRAIT_RANGES[t];
      value += rng.gaussian() * mutationMagnitude * (range.max - range.min);
      value = clampTrait(t, value);
    }
    cols[t][child] = value;
  }

  if (rng.next() < FREAK_MUTATION_RATE) {
    const t = rng.int(TRAIT_COUNT);
    const range = TRAIT_RANGES[t];
    cols[t][child] = range.min + rng.next() * (range.max - range.min);
    return true;
  }
  return false;
}
