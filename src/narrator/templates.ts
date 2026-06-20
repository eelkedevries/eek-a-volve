import type { NarratorStats } from './summary.ts';
import { binomial } from '../humour/names.ts';

/**
 * Templated fallback line in the wildlife-presenter voice, used when no key is
 * present or a narrator call fails. Built only from the supplied figures
 * (specification: Naming and voice).
 */
export function templatedLine(stats: NarratorStats): string {
  const name = binomial(stats.traitMeans);
  if (stats.milestone) return stats.milestone;
  if (stats.population === 0) {
    return 'And so the world falls silent. Extraordinary, while it lasted.';
  }
  // An optional aside when ornament is running wild under sexual selection.
  const flourish =
    stats.sexual === true && stats.ornament !== undefined && stats.ornament > 0.6
      ? ' And my, are they showing off.'
      : '';
  if (stats.births > stats.deaths) {
    return `A good season for our ${name} — ${stats.births} new arrivals against ${stats.deaths} losses. Onward!${flourish}`;
  }
  if (stats.deaths > stats.births) {
    return `Hard times for the ${name}: ${stats.deaths} lost, only ${stats.births} born. Nature, red in tooth and claw.`;
  }
  return `The ${name} holds steady — ${stats.population} strong across ${stats.speciesCount} species. Remarkable balance.${flourish}`;
}
