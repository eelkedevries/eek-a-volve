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
  minTimeMultiplier: 0.25,
  maxTimeMultiplier: 16,
};
