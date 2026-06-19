/**
 * Genome trait definitions.
 *
 * The genome is a fixed-length array of real-valued, clamped traits, stored
 * column-wise across the population in the structure-of-arrays world. The order
 * of `TRAITS` is the column order and must stay stable (specification: Data
 * schemas).
 */
export const TRAITS = [
  'size',
  'speed',
  'senseRadius',
  'metabolicEfficiency',
  'diet',
  'colourHue',
] as const;

export type TraitName = (typeof TRAITS)[number];

export const TRAIT_COUNT = TRAITS.length;

export interface TraitRange {
  readonly min: number;
  readonly max: number;
}

/** Valid range per trait, indexed in `TRAITS` order. */
export const TRAIT_RANGES: readonly TraitRange[] = [
  { min: 0.5, max: 2.0 }, // size
  { min: 0.0, max: 2.0 }, // speed
  { min: 0.0, max: 50.0 }, // senseRadius
  { min: 0.5, max: 1.5 }, // metabolicEfficiency
  { min: 0.0, max: 1.0 }, // diet: 0 herbivore … 1 carnivore
  { min: 0.0, max: 360.0 }, // colourHue (degrees)
];

/** One individual's traits, ordered as `TRAITS`. */
export type Genome = Float32Array;

/** Clamp a single trait value to its valid range. */
export function clampTrait(index: number, value: number): number {
  const { min, max } = TRAIT_RANGES[index];
  return value < min ? min : value > max ? max : value;
}

/** Clamp every trait of a genome in place, returning the same array. */
export function clampGenome(genome: Genome): Genome {
  for (let i = 0; i < TRAIT_COUNT; i++) genome[i] = clampTrait(i, genome[i]);
  return genome;
}
