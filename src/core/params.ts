/**
 * The pre-start parameter set: a single serialisable object from which — with
 * the fixed timestep — a run is fully reproducible (specification: Data schemas).
 * After a run starts, only the time multiplier and pause change.
 */
export interface SimulationParameters {
  /** World dimensions, in simulation units. */
  worldWidth: number;
  worldHeight: number;
  /** Seed for the deterministic generator. */
  seed: number;

  /** Agents present at the start. */
  initialPopulation: number;
  /** Distinct genetic clusters seeded at the start. */
  startingSpeciesCount: number;

  /** Food carrying capacity (the dominant control on population). */
  foodAbundance: number;
  /** Food items regenerated per tick, up to the carrying capacity. */
  foodRegenRate: number;

  /** Energy each agent starts with. */
  startingEnergy: number;
  /** Baseline metabolic drain per tick, before trait scaling. */
  baseMetabolicCost: number;
  /** Energy at which an agent may reproduce. */
  reproductionThreshold: number;

  /** Per-trait probability that a trait mutates in an offspring. */
  mutationRate: number;
  /** Standard deviation of the Gaussian mutation step. */
  mutationMagnitude: number;

  /** Whether carnivores may consume smaller agents. */
  predation: boolean;
  /** Whether catastrophe events may occur. */
  catastrophes: boolean;
  /** Whether a trickle of fresh-genome immigrants is introduced over time. */
  immigration: boolean;
  /** Whether reproduction is sexual (two parents, crossover) rather than asexual. */
  sexualReproduction: boolean;
  /** How the world is watched: an intimate "community" or a large "swarm". */
  viewMode: 'community' | 'swarm';

  /** Whether creatures lay and follow a pheromone trail (stigmergy). */
  pheromones: boolean;
  /** Cell size of the coarse pheromone field, in world units. */
  pheromoneCellSize: number;
  /** Per-tick multiplicative decay of the pheromone field (0..1). */
  pheromoneDecay: number;
  /** Per-tick diffusion blend toward the neighbour mean (0..1). */
  pheromoneDiffusion: number;
  /** Pheromone deposited into the current cell when a creature eats. */
  pheromoneDeposit: number;

  /** How strongly food regeneration favours fertile regions (0 = uniform). */
  biomeStrength: number;

  /** Seasonal swing in food regeneration (0 = none); a fraction of the base rate. */
  seasonAmplitude: number;
  /** Length of one seasonal cycle, in ticks. */
  seasonPeriod: number;

  /** Population ceiling and agent-pool capacity (default 2000 = MAX_POPULATION). */
  maxPopulation: number;

  /** Optional capability: drive movement with an evolvable neural net (default off). */
  neuralBrains: boolean;

  /** Optional capability: render via OffscreenCanvas in a worker (experimental, default off). */
  offscreenRender: boolean;

  /** Optional capability: run the metabolism pass in a WebAssembly core (experimental, default off). */
  wasmCore: boolean;

  /**
   * Optional coupling: extra per-tick metabolic drain for cognition, as a
   * fraction of base drain at maximal `senseRadius` (0 = off, the default, where
   * cognition is free). Makes perceptual/cognitive investment bounded by its
   * energy price. See docs-dev/planning/science_integration_plan.md (072).
   */
  cognitionCost: number;

  /**
   * The allometric exponent applied to `size` in the per-tick metabolic drain (a
   * debated modelling choice: ≈0.67 surface-rule, 0.75 Kleiber, 1.0 isometric).
   * A tunable coefficient whose default, 1, reproduces today's linear-in-size
   * cost byte-for-byte; sublinear values (<1) make large bodies relatively
   * cheaper. See docs-dev/planning/science_integration_plan.md (077).
   */
  metabolicExponent: number;

  /**
   * Optional coupling: how strongly a dense local conspecific group dilutes a
   * creature's per-capita predation risk (0 = off, the default). Above 0, a prey
   * amid many conspecifics is caught less often, saturating for large groups. See
   * docs-dev/planning/science_integration_plan.md (073).
   */
  groupingSafety: number;

  /**
   * Optional coupling (social-brain hypothesis): the default-off social return to
   * cognition. When on, a creature in a larger local conspecific group gains a
   * small, bounded foraging bonus that scales with its `senseRadius`, so a big
   * sense radius repays only in company — and only enough to matter where 072's
   * `cognitionCost` drain is also on. A genuine trade-off (it can be a net loss,
   * so mean `senseRadius` can fall), never a one-way upgrade. See
   * docs-dev/planning/science_integration_plan.md (079).
   */
  socialBrain: boolean;
  /** Strength of the social foraging return (the bounded bonus at full sense radius in a large group); inert when `socialBrain` is off. */
  socialBrainGain: number;

  /**
   * Optional coupling: a density/contact-dependent compartmental infection
   * (default off, the byte-for-byte default). When on, infected creatures infect
   * susceptible grid neighbours, run a timer to recovery or disease death, and a
   * costly host `resistance` trait can evolve. See
   * docs-dev/planning/science_integration_plan.md (074).
   */
  disease: boolean;
  /** Per-susceptible-neighbour probability of transmission per tick (inert when disease is off). */
  transmissionRate: number;
  /** Recovery rate per tick; the infection lasts ~1/recoveryRate ticks (inert when disease is off). */
  recoveryRate: number;
  /** Probability that a host dies (rather than recovers) when its infection ends (inert when disease is off). */
  diseaseMortality: number;
  /** Recovery confers lasting immunity (SIR) or returns the host to susceptible (SIS). */
  immunityMode: 'sir' | 'sis';

  /**
   * Optional coupling (Hamilton–Zuk): how strongly mate choice in sexual mode
   * with disease on avoids infected candidates (0 = off, the byte-for-byte
   * default). A signed coefficient — positive makes infected candidates less
   * attractive (choosers avoid the sick); negative is available to model the
   * competing position. Inert unless `disease` and `sexualReproduction` are both
   * on. See docs-dev/planning/science_integration_plan.md (078).
   */
  parasiteMatingBias: number;

  /**
   * Optional extension of the disease coupling: let the pathogen's `virulence`
   * evolve (default off; requires `disease`). When on, higher virulence raises
   * both transmission and host harm — shaped so an intermediate virulence
   * maximises onward spread — and mutates by a seeded clamped Gaussian step on
   * each transmission. With it off the disease pass behaves exactly as without
   * virulence (no extra generator draws). See
   * docs-dev/planning/science_integration_plan.md (075).
   */
  virulenceEvolves: boolean;
  /** How strongly virulence raises per-event transmission (the transmission–virulence slope; inert when off). */
  virulenceTransmissionGain: number;
  /** How strongly virulence shortens the infectious period (the host-harm–virulence slope; inert when off). */
  virulenceHarmGain: number;
  /** Standard deviation of the seeded Gaussian step mutating virulence on transmission (inert when off). */
  virulenceMutation: number;

  /**
   * Optional coupling (social learning — a [design-abstraction], never emergent):
   * a second, non-genetic inheritance channel (default off, the byte-for-byte
   * default). When on, each creature copies a fraction of its best grid
   * neighbour's `knowledge` with probability `transmissionFidelity`, and that
   * knowledge raises the effective energy gained from food (a real,
   * budget-respecting return — knowledge never creates energy from nothing).
   * Knowledge is acquired only after birth and is lost on death (a recycled slot
   * starts at zero), so mean knowledge can fall: it is a designed channel, not a
   * one-way upgrade. See docs-dev/planning/science_integration_plan.md (080).
   */
  culture: boolean;
  /** Per-copy adoption probability (0..1): how faithfully a learner copies its best neighbour (inert when `culture` is off). */
  transmissionFidelity: number;
  /** How strongly `knowledge` raises foraging yield: eating gives `1 + knowledgeForagingGain * knowledge` × food energy (inert when `culture` is off). */
  knowledgeForagingGain: number;
  /** Optional per-tick multiplicative loss of `knowledge` so it can fade without upkeep (inert when `culture` is off). */
  knowledgeDecay: number;

  /** Bounds on the post-start time multiplier (ticks per frame). */
  minTimeMultiplier: number;
  maxTimeMultiplier: number;
}

/**
 * Sensible starting defaults. Energy and population constants are provisional
 * and tuned for stability in the population-stability test (prompt 012), after
 * which the settled values are recorded in the specification.
 */
export const DEFAULT_PARAMETERS: SimulationParameters = {
  worldWidth: 800,
  worldHeight: 600,
  seed: 1,
  initialPopulation: 200,
  startingSpeciesCount: 3,
  foodAbundance: 400,
  foodRegenRate: 4,
  startingEnergy: 50,
  baseMetabolicCost: 0.1,
  reproductionThreshold: 80,
  mutationRate: 0.1,
  mutationMagnitude: 0.1,
  predation: true,
  catastrophes: false,
  immigration: false,
  sexualReproduction: false,
  viewMode: 'community',
  pheromones: false,
  pheromoneCellSize: 24,
  pheromoneDecay: 0.92,
  pheromoneDiffusion: 0.12,
  pheromoneDeposit: 6,
  biomeStrength: 0,
  seasonAmplitude: 0,
  seasonPeriod: 1200,
  maxPopulation: 2000,
  neuralBrains: false,
  offscreenRender: false,
  wasmCore: false,
  cognitionCost: 0,
  metabolicExponent: 1,
  groupingSafety: 0,
  socialBrain: false,
  socialBrainGain: 0.5,
  disease: false,
  transmissionRate: 0.05,
  recoveryRate: 0.02,
  diseaseMortality: 0.2,
  immunityMode: 'sir',
  parasiteMatingBias: 0,
  virulenceEvolves: false,
  virulenceTransmissionGain: 3,
  virulenceHarmGain: 2.5,
  virulenceMutation: 0.05,
  // Social learning (culture): off by default, so the whole channel is inert and
  // the run is byte-for-byte unchanged; the rest are sensible values used only
  // when `culture` is on.
  culture: false,
  transmissionFidelity: 0.5,
  knowledgeForagingGain: 0.5,
  knowledgeDecay: 0.01,
  minTimeMultiplier: 0.25,
  maxTimeMultiplier: 16,
};

/**
 * Mode presets applied at setup (not baked into the defaults, so the 012
 * stability test still runs on the raw `DEFAULT_PARAMETERS`). Community is small,
 * dense, and sexual — courtship is easy to see; swarm is large and asexual.
 */
export const COMMUNITY_PRESET: Partial<SimulationParameters> = {
  viewMode: 'community',
  worldWidth: 360,
  worldHeight: 360,
  initialPopulation: 140,
  foodAbundance: 240,
  foodRegenRate: 3,
  sexualReproduction: true,
  pheromones: true,
};

export const SWARM_PRESET: Partial<SimulationParameters> = {
  viewMode: 'swarm',
  worldWidth: 1200,
  worldHeight: 900,
  initialPopulation: 900,
  foodAbundance: 1100,
  foodRegenRate: 12,
  sexualReproduction: false,
  biomeStrength: 0.6,
};
