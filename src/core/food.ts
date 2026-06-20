import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import type { Rng } from './rng.ts';
import { fertilityAt } from './biome.ts';

export const PLANT = 0;
export const CARRION = 1;

/** Maximum rejection-sampling attempts when biasing food toward fertile regions. */
const BIOME_MAX_TRIES = 8;

/**
 * Deterministic seasonal multiplier on the food regeneration rate at `tick`
 * (specification: Domain rules → Population bounds). A smooth sinusoid of period
 * `seasonPeriod`, swinging by `seasonAmplitude`, clamped non-negative. Returns
 * exactly 1 when the season is off, so the regeneration path is unchanged.
 */
export function seasonalFactor(tick: number, params: SimulationParameters): number {
  if (params.seasonAmplitude <= 0 || params.seasonPeriod <= 0) return 1;
  const phase = (2 * Math.PI * tick) / params.seasonPeriod;
  const factor = 1 + params.seasonAmplitude * Math.sin(phase);
  return factor < 0 ? 0 : factor;
}

/** Energy yielded by eating a plant. */
export const PLANT_ENERGY = 25;
/** Food-pool slots reserved for carrion, beyond the plant carrying capacity. */
export const CARRION_RESERVE = 250;
/** Ticks a carrion item lasts before it rots away. */
export const CARRION_LIFETIME = 500;
/** Carrion energy per unit of the dead creature's size. */
export const CARRION_ENERGY_PER_SIZE = 22;

/** Plant carrying capacity (plants alone are capped at foodAbundance). */
function plantCapacity(world: World, params: SimulationParameters): number {
  return Math.min(params.foodAbundance, world.foodCapacity);
}

/** Place one plant at a random position; returns its slot, or -1 if the pool is full. */
function placePlant(world: World, params: SimulationParameters, rng: Rng): number {
  const slot = world.spawnFood();
  if (slot === -1) return -1;
  const b = params.biomeStrength;
  let px = rng.next() * params.worldWidth;
  let py = rng.next() * params.worldHeight;
  // With biomes on, reject barren candidates so food clusters in fertile regions.
  // The b <= 0 path above draws exactly as before, keeping uniform placement
  // byte-for-byte identical (deterministic; specification: Domain rules).
  if (b > 0) {
    for (let tries = 0; tries < BIOME_MAX_TRIES; tries++) {
      const f = fertilityAt(px, py, params.worldWidth, params.worldHeight, params.seed);
      if (rng.next() < 1 - b + b * f) break; // accept; certain at b=0, ∝ fertility at b=1
      px = rng.next() * params.worldWidth;
      py = rng.next() * params.worldHeight;
    }
  }
  world.foodX[slot] = px;
  world.foodY[slot] = py;
  world.foodType[slot] = PLANT;
  world.foodEnergy[slot] = PLANT_ENERGY;
  world.foodDecay[slot] = 0;
  world.plantCount++;
  return slot;
}

/** Fill the world with plants up to the carrying capacity (used when a run starts). */
export function seedFood(world: World, params: SimulationParameters, rng: Rng): void {
  const cap = plantCapacity(world, params);
  while (world.plantCount < cap) {
    if (placePlant(world, params, rng) === -1) break;
  }
}

/**
 * Regenerate plants for one tick: add `foodRegenRate` plants (its fractional part
 * resolved by one deterministic draw), never beyond the plant carrying capacity
 * (specification: Domain rules → Population bounds).
 */
export function regenerateFood(
  world: World,
  params: SimulationParameters,
  rng: Rng,
  tick = 0,
): void {
  const cap = plantCapacity(world, params);
  // The season only scales the rate when enabled, so the off path is unchanged.
  const rate =
    params.seasonAmplitude > 0 ? params.foodRegenRate * seasonalFactor(tick, params) : params.foodRegenRate;
  let count = Math.floor(rate);
  const frac = rate - count;
  if (frac > 0 && rng.next() < frac) count++;
  while (count > 0 && world.plantCount < cap) {
    if (placePlant(world, params, rng) === -1) break;
    count--;
  }
}

/** Drop a carrion item at a death site, within the carrion reserve (specification: Domain rules). */
export function dropCarrion(world: World, x: number, y: number, size: number): void {
  if (world.carrionCount >= CARRION_RESERVE) return;
  const slot = world.spawnFood();
  if (slot === -1) return;
  world.foodX[slot] = x;
  world.foodY[slot] = y;
  world.foodType[slot] = CARRION;
  world.foodEnergy[slot] = size * CARRION_ENERGY_PER_SIZE;
  world.foodDecay[slot] = CARRION_LIFETIME;
  world.carrionCount++;
}

/** Age carrion by one tick, removing items that have rotted away. */
export function decayCarrion(world: World): void {
  const { foodAlive, foodType, foodDecay, foodCapacity } = world;
  for (let f = 0; f < foodCapacity; f++) {
    if (foodAlive[f] === 0 || foodType[f] !== CARRION) continue;
    if (foodDecay[f] <= 1) world.killFood(f);
    else foodDecay[f]--;
  }
}

/** Remove an eaten food item; its slot becomes available again. */
export function consumeFood(world: World, slot: number): void {
  world.killFood(slot);
}
