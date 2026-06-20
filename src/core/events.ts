import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import type { Rng } from './rng.ts';
import { dropCarrion } from './food.ts';
import { SIZE } from './genome.ts';

export type CatastropheKind = 'meteor' | 'plague' | 'iceAge' | 'drought';

export const CATASTROPHE_KINDS: CatastropheKind[] = ['meteor', 'plague', 'iceAge', 'drought'];

/** Per-tick probability of a catastrophe when the toggle is on. */
export const CATASTROPHE_PROBABILITY = 0.0008;

const METEOR_RADIUS_FRACTION = 0.25;
const PLAGUE_KILL_PROBABILITY = 0.35;
const ICE_AGE_ENERGY_LOSS = 20;
const DROUGHT_KILL_FRACTION = 0.6;

export interface CatastropheEvent {
  kind: CatastropheKind;
  tick: number;
  deaths: number;
}

/**
 * Optional catastrophe events (specification: Domain rules → Events): discrete,
 * one-shot disturbances behind the catastrophe toggle. They only ever remove
 * agents or food, so the population bounds still hold. Deterministic via the
 * seeded generator. The most recent event is exposed for display/narration.
 */
export class Events {
  last: CatastropheEvent | null = null;

  /** Maybe trigger a catastrophe this tick; returns the deaths it caused (0 if none). */
  step(world: World, params: SimulationParameters, rng: Rng, tick: number): number {
    if (!params.catastrophes || rng.next() >= CATASTROPHE_PROBABILITY) return 0;
    const kind = CATASTROPHE_KINDS[rng.int(CATASTROPHE_KINDS.length)];
    const deaths = this.trigger(kind, world, params, rng);
    this.last = { kind, tick, deaths };
    return deaths;
  }

  /** Apply a specific catastrophe; returns the number of agents killed. */
  trigger(kind: CatastropheKind, world: World, params: SimulationParameters, rng: Rng): number {
    switch (kind) {
      case 'meteor':
        return this.meteor(world, params, rng);
      case 'plague':
        return this.plague(world, rng);
      case 'iceAge':
        return this.iceAge(world);
      case 'drought':
        this.drought(world, rng);
        return 0;
    }
  }

  private meteor(world: World, params: SimulationParameters, rng: Rng): number {
    const cx = rng.next() * params.worldWidth;
    const cy = rng.next() * params.worldHeight;
    const radius = Math.min(params.worldWidth, params.worldHeight) * METEOR_RADIUS_FRACTION;
    const r2 = radius * radius;
    let deaths = 0;
    for (let s = 0; s < world.agentCapacity; s++) {
      if (world.alive[s] === 0) continue;
      const dx = world.x[s] - cx;
      const dy = world.y[s] - cy;
      if (dx * dx + dy * dy <= r2) {
        dropCarrion(world, world.x[s], world.y[s], world.traits[SIZE][s]);
        world.killAgent(s);
        deaths++;
      }
    }
    return deaths;
  }

  private plague(world: World, rng: Rng): number {
    let deaths = 0;
    for (let s = 0; s < world.agentCapacity; s++) {
      if (world.alive[s] === 0) continue;
      if (rng.next() < PLAGUE_KILL_PROBABILITY) {
        dropCarrion(world, world.x[s], world.y[s], world.traits[SIZE][s]);
        world.killAgent(s);
        deaths++;
      }
    }
    return deaths;
  }

  private iceAge(world: World): number {
    let deaths = 0;
    for (let s = 0; s < world.agentCapacity; s++) {
      if (world.alive[s] === 0) continue;
      world.energy[s] -= ICE_AGE_ENERGY_LOSS;
      if (world.energy[s] <= 0) {
        dropCarrion(world, world.x[s], world.y[s], world.traits[SIZE][s]);
        world.killAgent(s);
        deaths++;
      }
    }
    return deaths;
  }

  private drought(world: World, rng: Rng): void {
    for (let s = 0; s < world.foodCapacity; s++) {
      if (world.foodAlive[s] === 1 && rng.next() < DROUGHT_KILL_FRACTION) world.killFood(s);
    }
  }
}
