import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import type { Rng } from './rng.ts';
import { TRAIT_COUNT, TRAIT_RANGES } from './genome.ts';
import { BRAIN_WEIGHT_COUNT } from './brain.ts';

/** Spread of a founder/immigrant's initial neural-net weights, when brains are on. */
const BRAIN_INIT_SCALE = 0.6;

/** Population at or below which a run is flagged as near-extinction. */
export const NEAR_EXTINCTION_THRESHOLD = 5;

/**
 * Hard ceiling on the number of agents. The world is sized to this, so the pool
 * itself enforces the ceiling (specification: Domain rules → Population bounds).
 * Provisional; tuned in 012 and then recorded in the specification.
 */
export const MAX_POPULATION = 2000;

/** Expected immigrants per tick when immigration is enabled. */
export const IMMIGRATION_RATE = 0.2;

/** True when the population is positive but at or below the near-extinction threshold. */
export function isNearExtinction(world: World): boolean {
  return world.population > 0 && world.population <= NEAR_EXTINCTION_THRESHOLD;
}

/**
 * Spawn an agent with a fresh, uniformly random genome and starting state, or
 * return -1 if the world is at capacity. Used both to seed a run and to admit
 * immigrants.
 */
export function spawnRandomAgent(
  world: World,
  params: SimulationParameters,
  rng: Rng,
  speciesId: number,
): number {
  const slot = world.spawnAgent();
  if (slot === -1) return -1;
  for (let t = 0; t < TRAIT_COUNT; t++) {
    const r = TRAIT_RANGES[t];
    world.traits[t][slot] = r.min + rng.next() * (r.max - r.min);
  }
  if (world.brainWeights !== null) {
    const base = slot * BRAIN_WEIGHT_COUNT;
    for (let k = 0; k < BRAIN_WEIGHT_COUNT; k++) {
      world.brainWeights[base + k] = (rng.next() * 2 - 1) * BRAIN_INIT_SCALE;
    }
  }
  world.x[slot] = rng.next() * params.worldWidth;
  world.y[slot] = rng.next() * params.worldHeight;
  world.energy[slot] = params.startingEnergy;
  world.vx[slot] = 0;
  world.vy[slot] = 0;
  world.speciesId[slot] = speciesId;
  return slot;
}

/**
 * If immigration is enabled, occasionally introduce fresh-genome immigrants,
 * deterministically and within the ceiling. Returns the number admitted.
 */
export function immigrate(world: World, params: SimulationParameters, rng: Rng): number {
  if (!params.immigration) return 0;
  let count = Math.floor(IMMIGRATION_RATE);
  const frac = IMMIGRATION_RATE - count;
  if (frac > 0 && rng.next() < frac) count++;
  let added = 0;
  for (let i = 0; i < count; i++) {
    if (spawnRandomAgent(world, params, rng, -1) === -1) break;
    added++;
  }
  return added;
}
