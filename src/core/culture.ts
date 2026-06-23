import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import type { SpatialGrid } from './grid.ts';
import type { Rng } from './rng.ts';

/**
 * Radius (world units) within which a learner can copy a neighbour's knowledge.
 * The reachable model density inside this radius is what sustains a population's
 * mean knowledge — when too few knowledgeable neighbours are reachable, copying
 * cannot offset loss-on-death (the seed for the Tasmania loss of prompt 082).
 */
export const COPY_RADIUS = 12;

/**
 * Upper bound on the learned `knowledge` scalar. Knowledge is a normalised
 * quantity in [0, KNOWLEDGE_MAX], so the foraging return
 * `1 + knowledgeForagingGain * knowledge` is bounded and never runs away
 * (specification: Domain rules → Culture — a [design-abstraction]).
 */
export const KNOWLEDGE_MAX = 1;

/**
 * Fraction of the gap to the best neighbour's knowledge that a successful copy
 * closes. A learner moves a fraction of the way *towards* its model rather than
 * adopting it outright, so knowledge diffuses gradually through a group. Scaled
 * by the copier's `socialLearning` propensity trait.
 */
export const COPY_FRACTION = 0.5;

/** Clamp a knowledge value to its valid range [0, KNOWLEDGE_MAX]. */
export function clampKnowledge(k: number): number {
  return k < 0 ? 0 : k > KNOWLEDGE_MAX ? KNOWLEDGE_MAX : k;
}

/**
 * The culture foraging multiplier (a [design-abstraction], v0.7.0): a creature
 * with more `knowledge` takes more energy from the food it actually eats —
 * `1 + knowledgeForagingGain * knowledge`. A real, budget-respecting return
 * (`feed` still caps at the size-based capacity), never energy from nothing.
 * Deterministic; adds no RNG. With `knowledge = 0` (the default, culture off) the
 * factor is exactly 1, so the feeding path is byte-for-byte unchanged.
 */
export function cultureForagingFactor(knowledge: number, gain: number): number {
  return 1 + gain * knowledge;
}

/**
 * Culture / social learning (specification: Domain rules → Culture — a
 * [design-abstraction], never emergent). A scaffolded second, non-genetic
 * inheritance channel: when `params.culture` is on, each live creature copies a
 * fraction of its best reachable neighbour's `knowledge` with probability
 * `transmissionFidelity`, and knowledge optionally decays each tick. Knowledge
 * raises foraging yield (applied in the behaviour/feeding path), is acquired only
 * after birth, and is lost on death — so mean knowledge can fall; it is a designed
 * channel, not a one-way upgrade.
 *
 * Runs as its own pass over current positions (reusing the agent grid like the
 * disease/predation passes). A reused object with a bound visitor and a
 * pre-allocated start-of-tick snapshot so the per-tick path allocates nothing,
 * and so the copy is order-independent (every learner reads the same start-of-tick
 * knowledge). When `params.culture` is off the pass draws no RNG and touches
 * nothing, so the default run is byte-for-byte unchanged.
 */
export class Culture {
  private world!: World;
  private fidelity = 0;
  private decay = 0;
  /** Start-of-tick knowledge, so a learner copies pre-update values (order-free). */
  private readonly snapshot: Float32Array;
  // Per-agent visitor state (set before each grid query).
  private self = -1;
  private bestKnowledge = 0;

  /** Visitor: track the highest start-of-tick knowledge among reachable neighbours. */
  private readonly onNeighbour = (id: number, _dist2: number): void => {
    if (id === this.self || this.world.alive[id] === 0) return;
    const k = this.snapshot[id];
    if (k > this.bestKnowledge) this.bestKnowledge = k;
  };

  constructor(agentCapacity: number) {
    this.snapshot = new Float32Array(agentCapacity);
  }

  /**
   * Resolve culture for one tick over the live agents indexed by `agentGrid`.
   * Draws no RNG and changes nothing when `params.culture` is off.
   */
  step(world: World, params: SimulationParameters, agentGrid: SpatialGrid, rng: Rng): void {
    if (!params.culture) return;
    this.world = world;
    this.fidelity = params.transmissionFidelity;
    this.decay = params.knowledgeDecay;
    const { alive, knowledge, x, y, agentCapacity } = world;

    // Snapshot start-of-tick knowledge so every learner copies the same values,
    // making the pass order-independent (and therefore deterministic).
    const snapshot = this.snapshot;
    for (let s = 0; s < agentCapacity; s++) snapshot[s] = alive[s] === 1 ? knowledge[s] : 0;

    for (let s = 0; s < agentCapacity; s++) {
      if (alive[s] === 0) continue;
      this.self = s;
      this.bestKnowledge = 0;
      agentGrid.query(x[s], y[s], COPY_RADIUS, this.onNeighbour);

      let k = snapshot[s];
      const own = k;
      // Copy: with probability `transmissionFidelity`, move a fraction of the gap
      // to the best neighbour's knowledge towards it. One seeded draw per copy
      // decision (the only RNG this pass draws), taken solely when culture is on.
      if (this.bestKnowledge > own && rng.next() < this.fidelity) {
        k = own + (this.bestKnowledge - own) * COPY_FRACTION;
      }
      // Optional per-tick decay, so knowledge fades without renewed copying.
      if (this.decay > 0) k *= 1 - this.decay;
      knowledge[s] = clampKnowledge(k);
    }
  }
}
