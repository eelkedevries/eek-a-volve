import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import { SIZE, SPEED, METABOLIC_EFFICIENCY } from './genome.ts';

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
  return (params.baseMetabolicCost * (size + speed)) / efficiency;
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
      world.killAgent(s);
      deaths++;
    }
  }
  return deaths;
}
