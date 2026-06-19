import { TRAITS, TRAIT_COUNT, TRAIT_RANGES } from '../core/genome.ts';

interface Roots {
  high: string;
  low: string;
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
