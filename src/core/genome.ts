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
  'display',
  'matePreference',
] as const;

export type TraitName = (typeof TRAITS)[number];

export const TRAIT_COUNT = TRAITS.length;

// Trait column indices, matching the order of `TRAITS`.
export const SIZE = 0;
export const SPEED = 1;
export const SENSE_RADIUS = 2;
export const METABOLIC_EFFICIENCY = 3;
export const DIET = 4;
export const COLOUR_HUE = 5;
/** Ornament magnitude — costly to carry, the target of sexual selection (v0.3.6). */
export const DISPLAY = 6;
/** Preferred ornament level in a mate (v0.3.6). */
export const MATE_PREFERENCE = 7;

/**
 * Number of leading "ecological" traits that define a species and compatibility.
 * The sexual traits (`display`, `matePreference`) sit after these and are
 * deliberately excluded from the genetic-distance gate and speciation clustering.
 */
export const SPECIES_TRAIT_COUNT = COLOUR_HUE + 1;

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
  { min: 0.0, max: 1.0 }, // display: 0 plain … 1 showy
  { min: 0.0, max: 1.0 }, // matePreference: 0 prefers plain … 1 prefers showy
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
