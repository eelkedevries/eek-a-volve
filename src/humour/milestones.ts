/** Inputs for a milestone update — only these figures may appear in the output. */
export interface MilestoneStats {
  tick: number;
  population: number;
  speciesCount: number;
  event?: { kind: string; deaths: number } | null;
}

const POPULATION_MARKS = [50, 100, 250, 500, 1000, 2000];

export function catastropheLine(event: { kind: string; deaths: number }): string {
  switch (event.kind) {
    case 'meteor':
      return `A meteor strikes! ${event.deaths} lost in a heartbeat.`;
    case 'plague':
      return `A plague sweeps the land — ${event.deaths} taken.`;
    case 'iceAge':
      return `An ice age bites; ${event.deaths} could not last the cold.`;
    case 'drought':
      return 'A drought withers the land and empties the larders.';
    default:
      return 'Something stirs in the world.';
  }
}

/**
 * Turns snapshot stats and events into short milestone and extinction lines in
 * the restrained comedic voice (specification: Naming and voice). Stateful, to
 * fire each milestone once; it invents no figures beyond those supplied.
 */
export class Milestones {
  private lastPopulation = 0;
  private lastSpeciesCount = 0;
  private highestMark = 0;
  private announcedExtinct = false;

  /** A milestone line for this update, or null if nothing notable happened. */
  update(stats: MilestoneStats): string | null {
    let line: string | null = null;

    if (stats.event) {
      line = catastropheLine(stats.event);
    } else if (stats.population === 0 && this.lastPopulation > 0 && !this.announcedExtinct) {
      this.announcedExtinct = true;
      line = 'Silence falls across the world — the last of them is gone.';
    } else {
      if (stats.population > 0) this.announcedExtinct = false;
      for (const mark of POPULATION_MARKS) {
        if (stats.population >= mark && mark > this.highestMark) {
          this.highestMark = mark;
          line = `The population has swelled past ${mark}.`;
          break;
        }
      }
      if (line === null && this.lastSpeciesCount > 0 && stats.speciesCount > this.lastSpeciesCount) {
        line = `A new lineage strikes out on its own — ${stats.speciesCount} now share the world.`;
      }
    }

    this.lastPopulation = stats.population;
    this.lastSpeciesCount = stats.speciesCount;
    return line;
  }
}
