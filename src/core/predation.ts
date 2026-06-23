import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import type { SpatialGrid } from './grid.ts';
import type { Rng } from './rng.ts';
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

/** Radius within which conspecifics count toward a prey's dilution group. */
export const GROUP_RADIUS = 30;

/**
 * Per-capita capture probability for a prey in a conspecific group of `groupSize`
 * (counting itself), given the `groupingSafety` coefficient. It falls with group
 * size and saturates (diminishing returns): an isolated prey (group size 1) is
 * always catchable, while ever-larger crowds give each member strong but
 * progressively smaller additional cover.
 */
export function captureProbability(groupSize: number, groupingSafety: number): number {
  return 1 / (1 + groupingSafety * (groupSize - 1));
}

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

  // Local conspecific group size of the current prey (for the dilution discount).
  private groupSpecies = 0;
  private groupCount = 0;

  private readonly onGroupMember = (id: number, _dist2: number): void => {
    if (this.world.alive[id] === 1 && this.world.speciesId[id] === this.groupSpecies) {
      this.groupCount++;
    }
  };

  /**
   * Resolve predation for one tick; returns the number of prey consumed. `rng` is
   * supplied whenever the grouping-safety dilution can apply (the live simulation
   * always passes it); when it is absent the discount is inert, so existing
   * callers and the default run are unaffected.
   */
  step(world: World, params: SimulationParameters, agentGrid: SpatialGrid, rng?: Rng): number {
    if (!params.predation) return 0;
    this.world = world;
    const { alive, x, y, traits, agentCapacity, speciesId } = world;
    const sizeCol = traits[SIZE];
    const dietCol = traits[DIET];
    const grouping = params.groupingSafety;

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
        // Dilution / selfish-herd: a prey amid many conspecifics is caught less
        // often, saturating for large groups. One seeded draw per attempt, and
        // only when the coupling is active — so the default run draws nothing and
        // is byte-for-byte unchanged.
        if (rng !== undefined && grouping > 0) {
          this.groupSpecies = speciesId[prey];
          this.groupCount = 0;
          agentGrid.query(x[prey], y[prey], GROUP_RADIUS, this.onGroupMember);
          if (rng.next() >= captureProbability(this.groupCount, grouping)) continue;
        }
        feed(world, s, sizeCol[prey] * PREY_ENERGY_FACTOR);
        world.killAgent(prey);
        world.action[s] = HUNTING;
        deaths++;
      }
    }
    return deaths;
  }
}
