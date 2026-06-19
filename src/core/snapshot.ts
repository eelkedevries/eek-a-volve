import type { Simulation } from './loop.ts';
import { TRAIT_COUNT, SIZE } from './genome.ts';

/** Header floats: tick, population, births, deaths, species count, then one mean per trait. */
export const HEADER_LENGTH = 5 + TRAIT_COUNT;
/** Floats per agent record: x, y, colour index, scale. */
export const AGENT_STRIDE = 4;

// Header field offsets.
export const H_TICK = 0;
export const H_POPULATION = 1;
export const H_BIRTHS = 2;
export const H_DEATHS = 3;
export const H_SPECIES_COUNT = 4;
export const H_TRAIT_MEANS = 5; // [H_TRAIT_MEANS, H_TRAIT_MEANS + TRAIT_COUNT)

/** Float32 length needed to hold a snapshot for up to `capacity` agents. */
export function snapshotLength(capacity: number): number {
  return HEADER_LENGTH + AGENT_STRIDE * capacity;
}

/**
 * Write a render snapshot of `sim` into `out` (at least
 * `snapshotLength(world.agentCapacity)` long): a fixed header of aggregate
 * statistics followed by one (x, y, colour index, scale) record per live agent.
 * Returns the number of agent records written (specification: Data schemas).
 *
 * Called at render cadence, not tick cadence, so the small scratch here does not
 * violate the per-tick no-allocation rule.
 */
export function serialiseSnapshot(sim: Simulation, out: Float32Array): number {
  const w = sim.world;
  const { alive, x, y, traits, speciesId, agentCapacity, population } = w;
  const sizeCol = traits[SIZE];

  const sums = new Float64Array(TRAIT_COUNT);
  const species = new Set<number>();
  let offset = HEADER_LENGTH;
  let count = 0;
  for (let s = 0; s < agentCapacity; s++) {
    if (alive[s] === 0) continue;
    out[offset] = x[s];
    out[offset + 1] = y[s];
    out[offset + 2] = speciesId[s];
    out[offset + 3] = sizeCol[s];
    offset += AGENT_STRIDE;
    for (let t = 0; t < TRAIT_COUNT; t++) sums[t] += traits[t][s];
    species.add(speciesId[s]);
    count++;
  }

  out[H_TICK] = sim.tick;
  out[H_POPULATION] = population;
  out[H_BIRTHS] = sim.births;
  out[H_DEATHS] = sim.deaths;
  out[H_SPECIES_COUNT] = species.size;
  for (let t = 0; t < TRAIT_COUNT; t++) out[H_TRAIT_MEANS + t] = count > 0 ? sums[t] / count : 0;
  return count;
}
