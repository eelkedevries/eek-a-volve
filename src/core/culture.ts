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
 * adopting it outright, so knowledge diffuses gradually through a group.
 */
export const COPY_FRACTION = 0.5;

/**
 * Innovation increment added on a successful copy (the cumulative ratchet, v0.7.1).
 * A learner can end up slightly *above* its model — the source of ratcheting —
 * but the increment is small and bounded (knowledge is clamped to KNOWLEDGE_MAX),
 * so "cumulative" means knowledge climbs to and holds a higher level under high
 * fidelity, not that it grows without limit. Folded into the existing copy branch,
 * so it draws no extra RNG.
 */
export const INNOVATION_INCREMENT = 0.04;

/**
 * Transmission-fidelity threshold for cumulative culture (v0.7.1). Above it, the
 * per-tick decay applied to knowledge is small, so innovations persist and ratchet
 * upward; below it, decay dominates and gains are lost. Accumulation is therefore
 * markedly **non-linear** in fidelity — trait longevity rises sharply
 * (≈exponentially) with fidelity around this threshold (the Lewis & Laland
 * result). A designed non-linearity, not an open-ended emergent property.
 */
export const FIDELITY_THRESHOLD = 0.5;

/**
 * Logistic steepness of the longevity transition around {@link FIDELITY_THRESHOLD}.
 * Larger ⇒ a sharper switch from "decays away" to "accumulates" as fidelity
 * crosses the threshold, giving the steep (≈exponential) rise in retained
 * knowledge with fidelity.
 */
export const RATCHET_STEEPNESS = 18;

/**
 * Extra per-tick decay imposed *below* the fidelity threshold (the ratchet is
 * conditional). Sub-threshold, knowledge loses this much per tick on top of the
 * base `knowledgeDecay`, so copied/innovated gains cannot accumulate; above the
 * threshold this extra term vanishes and only the small base decay remains.
 */
export const SUBTHRESHOLD_DECAY = 0.2;

/**
 * Extra per-tick decay imposed when the reachable population is fully sub-critical
 * (the Tasmania loss, v0.7.2). Scaled by how far the reachable model pool falls
 * short of `criticalCultureN`: when a creature can reach far fewer than the
 * critical number of models, copy opportunities are too sparse to offset this
 * loss, so mean knowledge declines; as the pool rebounds the extra decay relaxes
 * to zero and copying rebuilds knowledge (a U-shaped, reversible loss — no
 * absorbing floor). Zero when `criticalCultureN <= 0` (the gate is disabled).
 */
export const UNDERPOPULATION_DECAY = 0.5;

/**
 * Longevity weight in [0, 1] of knowledge at a given fidelity: ~0 well below the
 * threshold (gains decay away), ~1 well above it (gains persist and ratchet). A
 * logistic in `fidelity - FIDELITY_THRESHOLD`, so the retained level rises steeply
 * (≈exponentially) with fidelity around the threshold — accumulation is non-linear
 * in fidelity, not proportional (the cumulative-ratchet [design-abstraction]).
 */
export function longevityFactor(fidelity: number): number {
  return 1 / (1 + Math.exp(-RATCHET_STEEPNESS * (fidelity - FIDELITY_THRESHOLD)));
}

/**
 * Knowledge level a creature must reach before the gene–culture practice unlocks
 * the designated resource for it (the "dairying" know-how; v0.7.3). Below this the
 * unlock is absent and selection on the target trait relaxes (reversibility).
 */
export const GENE_CULTURE_KNOWLEDGE_LEVEL = 0.5;

/**
 * Target `size` band for the gene–culture unlock (v0.7.3): the designated resource
 * (the plant staple) is exploitable *well* only by creatures with `size` at or
 * above this — the "persistence" genotype, here a larger body able to process the
 * culturally-prepared resource. Above-band creatures take much more energy from it
 * where the practice is present; below-band creatures take little. `size` ranges
 * 0.5..2.0 (genome.ts), so this sits above the mid-range.
 */
export const GENE_CULTURE_SIZE_BAND = 1.25;

/**
 * Gene–culture foraging multiplier for the designated resource (plants), the
 * lactase-persistence analogue (v0.7.3). Deterministic; adds no RNG. Completely
 * inert (factor 1) unless `culture` is on, `geneCultureCoupling > 0`, the food is
 * the designated resource, and the eater's `knowledge` is above the unlock level —
 * in which case an above-band eater (`size >= GENE_CULTURE_SIZE_BAND`) gains a
 * bonus scaling with the coupling, while a below-band eater gets little (the
 * resource is "locked" to the persistence genotype). The unlock relaxes as soon as
 * knowledge falls below the level, so the feedback is reversible. `isGated` is
 * whether this food item is the designated resource (a plant).
 */
export function geneCultureFactor(
  isGated: boolean,
  size: number,
  knowledge: number,
  coupling: number,
): number {
  if (coupling <= 0 || !isGated || knowledge < GENE_CULTURE_KNOWLEDGE_LEVEL) return 1;
  if (size >= GENE_CULTURE_SIZE_BAND) {
    // The persistence genotype exploits the culturally-unlocked resource.
    return 1 + coupling;
  }
  // Locked to others: the resource gives little without the genotype. Reduced
  // (never below zero) rather than removed, so the staple stays survivable while
  // the differential drives selection toward the above-band genotype.
  return 1 / (1 + coupling);
}

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
 * `transmissionFidelity`, gains a small innovation increment on a successful copy,
 * and loses knowledge to a fidelity-dependent decay each tick. Above a fidelity
 * threshold the decay is small so innovations persist and **ratchet** upward;
 * below it decay dominates and gains are lost — accumulation is markedly
 * non-linear in fidelity (the cumulative-ratchet [design-abstraction], v0.7.1).
 * Knowledge stays bounded, raises foraging yield (applied in the behaviour/feeding
 * path), is acquired only after birth, and is lost on death — so mean knowledge
 * can fall; it is a designed channel, not a one-way upgrade.
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
  private criticalN = 0;
  /** Start-of-tick knowledge, so a learner copies pre-update values (order-free). */
  private readonly snapshot: Float32Array;
  // Per-agent visitor state (set before each grid query).
  private self = -1;
  private bestKnowledge = 0;
  /** Count of live neighbours reachable within the copy radius (the local model pool). */
  private localModels = 0;

  /** Visitor: track the best reachable knowledge and count the reachable models. */
  private readonly onNeighbour = (id: number, _dist2: number): void => {
    if (id === this.self || this.world.alive[id] === 0) return;
    this.localModels++;
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
    this.criticalN = params.criticalCultureN;
    const { alive, knowledge, x, y, agentCapacity } = world;

    // Fidelity-dependent longevity (the cumulative ratchet, v0.7.1): above the
    // fidelity threshold the extra sub-threshold decay vanishes (gains persist and
    // ratchet); below it, it dominates (gains decay away). The retained level
    // therefore rises steeply (≈exponentially) with fidelity around the threshold.
    // The base (fidelity) part is the same for every agent, so compute it once; the
    // Tasmania part below depends on each creature's reachable population.
    const longevity = longevityFactor(this.fidelity);
    const baseDecay = this.decay + (1 - longevity) * SUBTHRESHOLD_DECAY;

    // Snapshot start-of-tick knowledge so every learner copies the same values,
    // making the pass order-independent (and therefore deterministic).
    const snapshot = this.snapshot;
    for (let s = 0; s < agentCapacity; s++) snapshot[s] = alive[s] === 1 ? knowledge[s] : 0;

    for (let s = 0; s < agentCapacity; s++) {
      if (alive[s] === 0) continue;
      this.self = s;
      this.bestKnowledge = 0;
      this.localModels = 0;
      agentGrid.query(x[s], y[s], COPY_RADIUS, this.onNeighbour);

      let k = snapshot[s];
      const own = k;
      // Social learning: with probability `transmissionFidelity` the creature
      // engages in cultural transmission this tick (one seeded draw per decision —
      // the only RNG this pass draws, taken solely when culture is on). It moves a
      // fraction of the way toward its best model (a more-knowledgeable neighbour,
      // if any) and adds a small innovation increment, so a learner can end up
      // slightly *above* its model — the source of ratcheting. The innovation is
      // folded into the same branch, so it adds no extra draw. With no better
      // neighbour the increment alone applies, so a practice can also arise and
      // build from scratch (bounded by the clamp); whether it *persists* is set by
      // the decay below.
      if (rng.next() < this.fidelity) {
        const learned = this.bestKnowledge > own ? own + (this.bestKnowledge - own) * COPY_FRACTION : own;
        k = learned + INNOVATION_INCREMENT;
      }
      // Tasmania maintenance (v0.7.2): tie knowledge maintenance to the *effective*
      // (reachable) population. When fewer than `criticalCultureN` live neighbours
      // are reachable, an extra decay term (scaled by the shortfall) is added on top
      // of the base decay, so loss outpaces the copying above — mean knowledge
      // falls. As the reachable pool rebounds the extra term relaxes to zero and
      // copying rebuilds knowledge (a U-shaped, reversible loss, no absorbing
      // floor). `criticalCultureN <= 0` disables the gate.
      let decay = baseDecay;
      if (this.criticalN > 0 && this.localModels < this.criticalN) {
        const shortfall = 1 - this.localModels / this.criticalN;
        decay += shortfall * UNDERPOPULATION_DECAY;
      }
      // Per-tick decay (the ratchet plus the Tasmania term), bounding knowledge
      // along with the clamp.
      if (decay > 0) k *= 1 - decay;
      knowledge[s] = clampKnowledge(k);
    }
  }
}
