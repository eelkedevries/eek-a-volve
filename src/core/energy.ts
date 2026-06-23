import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import { SIZE, SPEED, SENSE_RADIUS, METABOLIC_EFFICIENCY, DISPLAY, TRAIT_RANGES } from './genome.ts';
import { dropCarrion } from './food.ts';

/** Extra metabolic drain a full ornament (`display` = 1) adds, in sexual mode. */
export const DISPLAY_COST = 0.06;

/** Sense radius at which a full `cognitionCost` applies (the trait's maximum). */
const SENSE_MAX = TRAIT_RANGES[SENSE_RADIUS].max;

/**
 * Maximum age in ticks before an agent dies of old age. Provisional; tuned for
 * stability in the population-stability test (prompt 012) and then recorded in
 * the specification.
 */
export const MAX_AGE = 3000;

/** Energy capacity for an agent of the given size — larger agents store more. */
export function energyCapacity(size: number): number {
  return 100 * size;
}

/**
 * Per-tick metabolic drain for one agent: the baseline cost scaled up by size
 * and speed and down by metabolic efficiency (specification: Domain rules →
 * Energy budget).
 */
export function metabolicCost(
  world: World,
  slot: number,
  params: SimulationParameters,
): number {
  const size = world.traits[SIZE][slot];
  const speed = world.traits[SPEED][slot];
  const efficiency = world.traits[METABOLIC_EFFICIENCY][slot];
  let cost = (params.baseMetabolicCost * (size + speed)) / efficiency;
  // Cognition is expensive: a larger sense radius (perceptual/cognitive
  // investment) drains more energy, so it is bounded by its foraging payoff
  // rather than free. Off by default — cognitionCost 0 makes the factor exactly
  // 1, leaving the default run (and the 012 stability test) unchanged.
  cost *= 1 + params.cognitionCost * (world.traits[SENSE_RADIUS][slot] / SENSE_MAX);
  // Ornament is honest: carrying a costly display drains more energy, but only
  // in sexual mode (so the asexual default — and the 012 stability test — is
  // unchanged; the trait merely drifts there).
  if (params.sexualReproduction) {
    cost *= 1 + DISPLAY_COST * world.traits[DISPLAY][slot];
  }
  return cost;
}

/** Add energy from eating, capped by the agent's size-based capacity. */
export function feed(world: World, slot: number, amount: number): void {
  const cap = energyCapacity(world.traits[SIZE][slot]);
  const gained = world.energy[slot] + amount;
  world.energy[slot] = gained > cap ? cap : gained;
}

/**
 * Apply metabolic drain and ageing to every live agent, killing those that run
 * out of energy or exceed the maximum age. Returns the number of deaths.
 */
export function metaboliseAndReap(world: World, params: SimulationParameters): number {
  let deaths = 0;
  const { alive, energy, age, agentCapacity } = world;
  for (let s = 0; s < agentCapacity; s++) {
    if (alive[s] === 0) continue;
    energy[s] -= metabolicCost(world, s, params);
    age[s] += 1;
    if (energy[s] <= 0 || age[s] > MAX_AGE) {
      dropCarrion(world, world.x[s], world.y[s], world.traits[SIZE][s]);
      world.killAgent(s);
      deaths++;
    }
  }
  return deaths;
}
