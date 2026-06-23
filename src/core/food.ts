import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import type { Rng } from './rng.ts';
import type { Transitions } from './transitions.ts';
import { fertilityAt } from './biome.ts';

export const PLANT = 0;
export const CARRION = 1;

/** Maximum rejection-sampling attempts when biasing food toward fertile regions. */
const BIOME_MAX_TRIES = 8;

/** Maximum rejection-sampling attempts when biasing food by the transitions
 *  per-region regeneration multiplier (the complexity-state local effect, v0.8.0). */
const TRANSITION_MAX_TRIES = 8;

/**
 * Small, fixed upper bound on the *extra* plants regenerated per tick while any region
 * is in the complexity state (the local "technology → carrying capacity" lift). It is a
 * single global cap — not per-region — so the total food *flux* rises only modestly
 * however many regions activate, keeping the global population bounded near the
 * baseline while the lift is concentrated locally by the placement bias. The overshoot
 * and decline are therefore **local** (a region tracks its own food), not a global
 * explosion; both population bounds remain intact.
 */
const TRANSITION_EXTRA_CAP = 2;

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

/**
 * Place one plant biased by the transitions per-region regeneration multiplier
 * (v0.8.0): a complexity-state region (multiplier > 1) accepts candidates readily so
 * food clusters there (technology → local carrying capacity), while a degraded region
 * (multiplier < 1) rejects most candidates so it is starved of replenishment and its
 * local population declines. Mirrors the biome rejection-sampling idiom; like it, a
 * plant that exhausts its tries still places at the last candidate, so a slot is never
 * wasted. Used only when `transitions` is on (which also forces the TS regen path), so
 * the off path is byte-for-byte unchanged.
 */
function placePlantTransitions(
  world: World,
  params: SimulationParameters,
  rng: Rng,
  transitions: Transitions,
): number {
  const slot = world.spawnFood();
  if (slot === -1) return -1;
  let px = rng.next() * params.worldWidth;
  let py = rng.next() * params.worldHeight;
  for (let tries = 0; tries < TRANSITION_MAX_TRIES; tries++) {
    // Accept with probability = the region's regeneration multiplier (clamped to a
    // probability): certain in a boosted region, increasingly rejected as a region
    // degrades. Biomes, if also on, are folded in multiplicatively.
    let accept = transitions.regionRegenMultiplier(px, py);
    if (params.biomeStrength > 0) {
      const b = params.biomeStrength;
      const f = fertilityAt(px, py, params.worldWidth, params.worldHeight, params.seed);
      accept *= 1 - b + b * f;
    }
    if (accept > 1) accept = 1;
    if (rng.next() < accept) break;
    px = rng.next() * params.worldWidth;
    py = rng.next() * params.worldHeight;
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
 *
 * When `transitions` is supplied (the complexity-state coupling is on, v0.8.0), active
 * regions get a few extra plants (the local technology lift) and placement is biased by
 * the per-region multiplier so food clusters in active regions and is withheld from
 * degraded ones — but the global plant cap is unchanged, so both population bounds still
 * hold. Omitting `transitions` (the default) leaves the regeneration path byte-for-byte
 * unchanged.
 */
export function regenerateFood(
  world: World,
  params: SimulationParameters,
  rng: Rng,
  tick = 0,
  transitions?: Transitions,
): void {
  const cap = plantCapacity(world, params);
  // The season only scales the rate when enabled, so the off path is unchanged.
  const rate =
    params.seasonAmplitude > 0 ? params.foodRegenRate * seasonalFactor(tick, params) : params.foodRegenRate;
  let count = Math.floor(rate);
  const frac = rate - count;
  if (frac > 0 && rng.next() < frac) count++;
  if (transitions !== undefined) {
    // Local technology lift: a small, *globally capped* number of extra plants when any
    // region is active (so the total food flux rises only modestly, keeping the global
    // population bounded), with placement biased by the per-region sampler so the lift
    // concentrates in active regions and is withheld from degraded ones — a *local*
    // overshoot/decline, not a global explosion. The global plant cap still bounds the
    // standing pool, so both population bounds hold.
    if (transitions.activeRegionCount() > 0) count += TRANSITION_EXTRA_CAP;
    while (count > 0 && world.plantCount < cap) {
      if (placePlantTransitions(world, params, rng, transitions) === -1) break;
      count--;
    }
    return;
  }
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
