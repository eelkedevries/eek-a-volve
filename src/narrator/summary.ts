import { binomial } from '../humour/names.ts';

/** The figures a narrator line may draw on — nothing outside this may be invented. */
export interface NarratorStats {
  tick: number;
  population: number;
  births: number;
  deaths: number;
  speciesCount: number;
  traitMeans: ArrayLike<number>;
  milestone?: string | null;
  /** The most recent notable event line, so the narrator's words match the feed. */
  latestEvent?: string | null;
}

/**
 * A compact, factual summary of the supplied stats, for the narrator model
 * (specification: Naming and voice — the narrator must not invent statistics
 * absent from the supplied snapshot). Pure and deterministic.
 */
export function summarise(stats: NarratorStats): string {
  const name = binomial(stats.traitMeans);
  const parts = [
    `Tick ${stats.tick}.`,
    `Population ${stats.population} across ${stats.speciesCount} species.`,
    `${stats.births} born and ${stats.deaths} died since the last look.`,
    `The dominant form is a ${name}.`,
  ];
  if (stats.latestEvent) parts.push(`Lately: ${stats.latestEvent}`);
  if (stats.milestone) parts.push(stats.milestone);
  return parts.join(' ');
}
