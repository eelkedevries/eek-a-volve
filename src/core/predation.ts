import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import type { SpatialGrid } from './grid.ts';
import { SIZE, DIET } from './genome.ts';
import { feed } from './energy.ts';
import { HUNTING } from './state.ts';

/** Diet above which an agent hunts. */
export const CARNIVORY_THRESHOLD = 0.6;
/** Prey size must be below this fraction of the predator's size. */
export const PREY_SIZE_RATIO = 0.8;
/** Distance within which a predator can strike. */
export const ATTACK_RADIUS = 5;
/** Energy gained per unit of prey size (provisional; tuned for stability). */
export const PREY_ENERGY_FACTOR = 30;

/**
 * Predation (specification: Domain rules → Predation): when enabled, a
 * sufficiently carnivorous agent that is larger than a neighbour may consume it
 * for energy. Runs as its own pass after behaviour, over current positions. A
 * reused object with a bound visitor so the per-tick path allocates nothing.
 */
export class Predation {
  private world!: World;
  private self = -1;
  private selfSize = 0;
  private bestPrey = -1;
  private bestPreyDist2 = Infinity;

  private readonly onAgent = (id: number, dist2: number): void => {
    if (id === this.self) return;
    if (this.world.traits[SIZE][id] < this.selfSize * PREY_SIZE_RATIO && dist2 < this.bestPreyDist2) {
      this.bestPreyDist2 = dist2;
      this.bestPrey = id;
    }
  };

  /** Resolve predation for one tick; returns the number of prey consumed. */
  step(world: World, params: SimulationParameters, agentGrid: SpatialGrid): number {
    if (!params.predation) return 0;
    this.world = world;
    const { alive, x, y, traits, agentCapacity } = world;
    const sizeCol = traits[SIZE];
    const dietCol = traits[DIET];

    let deaths = 0;
    for (let s = 0; s < agentCapacity; s++) {
      if (alive[s] === 0 || dietCol[s] <= CARNIVORY_THRESHOLD) continue;
      this.self = s;
      this.selfSize = sizeCol[s];
      this.bestPrey = -1;
      this.bestPreyDist2 = Infinity;
      agentGrid.query(x[s], y[s], ATTACK_RADIUS, this.onAgent);

      const prey = this.bestPrey;
      if (prey !== -1 && alive[prey] === 1) {
        feed(world, s, sizeCol[prey] * PREY_ENERGY_FACTOR);
        world.killAgent(prey);
        world.action[s] = HUNTING;
        deaths++;
      }
    }
    return deaths;
  }
}
