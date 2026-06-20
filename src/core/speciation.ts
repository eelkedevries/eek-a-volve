import type { World } from './world.ts';
import { SPECIES_TRAIT_COUNT, TRAIT_RANGES } from './genome.ts';

/** Normalised genetic distance above which two agents are treated as different species. */
export const SPECIES_DISTANCE_THRESHOLD = 0.3;

/**
 * Emergent speciation (specification: Domain rules → Speciation): agents are
 * clustered by genetic distance above a threshold and assigned species labels
 * for display and narration. Single-pass leader clustering over range-normalised
 * trait vectors — deterministic in slot order. Species ids are only labels; they
 * do not affect the simulation's dynamics. A reused object so it allocates
 * nothing per call.
 */
export class Speciation {
  private readonly maxLeaders: number;
  private readonly leaders: Float64Array;
  private leaderCount = 0;

  constructor(maxLeaders = 64) {
    this.maxLeaders = maxLeaders;
    this.leaders = new Float64Array(maxLeaders * SPECIES_TRAIT_COUNT);
  }

  /** Cluster live agents, writing species ids into `world.speciesId`; returns the species count. */
  cluster(world: World): number {
    this.leaderCount = 0;
    const { alive, traits, speciesId, agentCapacity } = world;
    const threshold2 = SPECIES_DISTANCE_THRESHOLD * SPECIES_DISTANCE_THRESHOLD;

    for (let s = 0; s < agentCapacity; s++) {
      if (alive[s] === 0) continue;

      let best = -1;
      let bestDist2 = Infinity;
      for (let l = 0; l < this.leaderCount; l++) {
        const base = l * SPECIES_TRAIT_COUNT;
        let d2 = 0;
        for (let t = 0; t < SPECIES_TRAIT_COUNT; t++) {
          const r = TRAIT_RANGES[t];
          const norm = (traits[t][s] - r.min) / (r.max - r.min);
          const diff = norm - this.leaders[base + t];
          d2 += diff * diff;
        }
        if (d2 < bestDist2) {
          bestDist2 = d2;
          best = l;
        }
      }

      if (best !== -1 && bestDist2 <= threshold2) {
        speciesId[s] = best;
      } else if (this.leaderCount < this.maxLeaders) {
        const base = this.leaderCount * SPECIES_TRAIT_COUNT;
        for (let t = 0; t < SPECIES_TRAIT_COUNT; t++) {
          const r = TRAIT_RANGES[t];
          this.leaders[base + t] = (traits[t][s] - r.min) / (r.max - r.min);
        }
        speciesId[s] = this.leaderCount;
        this.leaderCount++;
      } else {
        speciesId[s] = best === -1 ? 0 : best;
      }
    }
    return this.leaderCount;
  }
}
