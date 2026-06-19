import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import type { Rng } from './rng.ts';

/** Place one food item at a random position; returns its slot, or -1 if the pool is full. */
function placeFood(world: World, params: SimulationParameters, rng: Rng): number {
  const slot = world.spawnFood();
  if (slot === -1) return -1;
  world.foodX[slot] = rng.next() * params.worldWidth;
  world.foodY[slot] = rng.next() * params.worldHeight;
  return slot;
}

/** The carrying capacity actually usable, bounded by the food pool size. */
function carryingCapacity(world: World, params: SimulationParameters): number {
  return Math.min(params.foodAbundance, world.foodCapacity);
}

/** Fill the world with food up to its carrying capacity (used when a run starts). */
export function seedFood(world: World, params: SimulationParameters, rng: Rng): void {
  const cap = carryingCapacity(world, params);
  while (world.foodCount < cap) placeFood(world, params, rng);
}

/**
 * Regenerate food for one tick: add `foodRegenRate` new items (its fractional
 * part resolved by a single deterministic draw), but never beyond the carrying
 * capacity (specification: Domain rules → Population bounds).
 */
export function regenerateFood(world: World, params: SimulationParameters, rng: Rng): void {
  const cap = carryingCapacity(world, params);
  let count = Math.floor(params.foodRegenRate);
  const frac = params.foodRegenRate - count;
  if (frac > 0 && rng.next() < frac) count++;
  while (count > 0 && world.foodCount < cap) {
    placeFood(world, params, rng);
    count--;
  }
}

/** Remove an eaten food item; its slot becomes available for later regeneration. */
export function consumeFood(world: World, slot: number): void {
  world.killFood(slot);
}
