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
  /** Mean display/ornament level [0, 1], supplied only when sexual selection is on. */
  ornament?: number;
  /** Whether sexual reproduction (and thus sexual selection) is active. */
  sexual?: boolean;
  /** Whether spatial biomes are active. */
  biomes?: boolean;
  /** Whether pheromone trails are active. */
  pheromones?: boolean;
}

/** Describe an ornament level in words, for the ornament clause. */
function ornamentWord(level: number): string {
  return level > 0.6 ? 'flamboyantly ornamented' : level < 0.35 ? 'plain and unadorned' : 'modestly adorned';
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
  if (stats.sexual === true && stats.ornament !== undefined) {
    parts.push(`Courtship favours the ${ornamentWord(stats.ornament)}.`);
  }
  const env: string[] = [];
  if (stats.biomes === true) env.push('patchy, biome-divided ground');
  if (stats.pheromones === true) env.push('a web of scent trails');
  if (env.length > 0) parts.push(`They cross ${env.join(' and ')}.`);
  if (stats.latestEvent) parts.push(`Lately: ${stats.latestEvent}`);
  if (stats.milestone) parts.push(stats.milestone);
  return parts.join(' ');
}
