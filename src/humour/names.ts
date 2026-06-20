import { TRAITS, TRAIT_COUNT, TRAIT_RANGES } from '../core/genome.ts';
import { Rng } from '../core/rng.ts';

interface Roots {
  high: string;
  low: string;
}

/** Mundane first names, for the "Gary" half of the joke. */
const PLAIN_NAMES = [
  'Gary', 'Mabel', 'Keith', 'Brenda', 'Nigel', 'Doris', 'Trevor', 'Sandra',
  'Colin', 'Ethel', 'Barry', 'Glenda', 'Norman', 'Gwen', 'Reg', 'Pam',
  'Clive', 'Maureen', 'Derek', 'Sheila',
];

/** Silly compound-name parts, for the "Wigglethorpe" half. */
const NAME_PREFIXES = [
  'Wiggle', 'Snuffle', 'Bumble', 'Squish', 'Wobble', 'Grumble', 'Doodle',
  'Pickle', 'Noodle', 'Toddle', 'Fluster', 'Squelch', 'Mumble', 'Waddle', 'Bramble',
];
const NAME_SUFFIXES = [
  'thorpe', 'bottom', 'worth', 'sworth', 'button', 'kins', 'sby', 'ington',
  'snout', 'whistle', 'puff', 'bert', 'wick', 'ridge', 'bury',
];

/**
 * A silly, stable individual name for a creature, seeded by its stable id (025).
 * Distinct from the species {@link binomial}: this is the relatability spine the
 * feed, inspector, and records reuse so the same creature is always the same
 * "Gary" or "Wigglethorpe". Deterministic for a given id.
 */
export function personalName(id: number): string {
  const rng = new Rng((id >>> 0) || 1);
  if (rng.next() < 0.45) return PLAIN_NAMES[rng.int(PLAIN_NAMES.length)];
  return NAME_PREFIXES[rng.int(NAME_PREFIXES.length)] + NAME_SUFFIXES[rng.int(NAME_SUFFIXES.length)];
}

/** Mock-Latin roots per trait, for its high and low extremes. */
const ROOTS: Record<string, Roots> = {
  size: { high: 'Rotundus', low: 'Minimus' },
  speed: { high: 'Velox', low: 'Lentus' },
  senseRadius: { high: 'Oculus', low: 'Caecus' },
  metabolicEfficiency: { high: 'Frugalis', low: 'Vorax' },
  diet: { high: 'Carnifex', low: 'Herbivorus' },
  colourHue: { high: 'Pictus', low: 'Pallidus' },
};

/**
 * A mock-Latin binomial derived from a species' mean trait vector
 * (specification: Naming and voice). The genus comes from the most extreme
 * trait, the species epithet from the next — so a large, slow lineage reads as
 * a *Rotundus lentus*. Deterministic for a given trait profile.
 */
export function binomial(means: ArrayLike<number>): string {
  const ranked: { index: number; extremity: number; high: boolean }[] = [];
  for (let t = 0; t < TRAIT_COUNT; t++) {
    const r = TRAIT_RANGES[t];
    const norm = (means[t] - r.min) / (r.max - r.min);
    ranked.push({ index: t, extremity: Math.abs(norm - 0.5), high: norm >= 0.5 });
  }
  ranked.sort((a, b) => b.extremity - a.extremity || a.index - b.index);
  const genus = rootOf(ranked[0].index, ranked[0].high);
  const species = rootOf(ranked[1].index, ranked[1].high).toLowerCase();
  return `${genus} ${species}`;
}

function rootOf(index: number, high: boolean): string {
  const roots = ROOTS[TRAITS[index]];
  return high ? roots.high : roots.low;
}
