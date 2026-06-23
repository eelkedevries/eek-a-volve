import type { World } from './world.ts';
import type { SimulationParameters } from './params.ts';
import type { SpatialGrid } from './grid.ts';
import type { Rng } from './rng.ts';
import { SIZE, RESISTANCE } from './genome.ts';
import { dropCarrion } from './food.ts';

/**
 * Radius (world units) within which an infected host can transmit to a
 * susceptible grid neighbour. Density-dependent transmission (βSI): denser
 * surroundings mean more susceptible neighbours and so more infection events. A
 * frequency-dependent variant (βSI/N) would divide the per-event rate by the
 * local crowd size; it is left as a runtime-cost escape hatch, not the default.
 */
export const TRANSMISSION_RADIUS = 12;

/**
 * How strongly a host's `resistance` trait (0..1) lowers its chance of being
 * infected: at full resistance the per-event transmission probability is scaled
 * by `1 - RESISTANCE_INFECTION_GUARD`, so resistance never grants total immunity
 * but does pay under pathogen pressure.
 */
export const RESISTANCE_INFECTION_GUARD = 0.8;

/** Smallest infection duration in ticks, so a newly infected host lasts at least this long. */
const MIN_INFECTION_TICKS = 1;
/** Largest infection duration in ticks (also the Uint16 timer ceiling guard). */
const MAX_INFECTION_TICKS = 60000;

/**
 * Number of ticks an infection lasts, derived from `recoveryRate`: the expected
 * infectious period is ~1/recoveryRate. Clamped to a sane, storable range.
 */
export function infectionDuration(recoveryRate: number): number {
  if (recoveryRate <= 0) return MAX_INFECTION_TICKS;
  const ticks = Math.round(1 / recoveryRate);
  return ticks < MIN_INFECTION_TICKS
    ? MIN_INFECTION_TICKS
    : ticks > MAX_INFECTION_TICKS
      ? MAX_INFECTION_TICKS
      : ticks;
}

/** Infection compartments stored in `world.infectionState`. */
export const SUSCEPTIBLE = 0;
export const INFECTED = 1;
export const RECOVERED = 2;

/** Valid range of the evolving pathogen virulence (a normalised scalar). */
export const VIRULENCE_MIN = 0;
export const VIRULENCE_MAX = 1;
/** Virulence carried by the seeded patient-zero strain (mid-range, so it can climb or fall). */
export const INITIAL_VIRULENCE = 0.5;

/** Clamp a virulence value to its valid range. */
export function clampVirulence(v: number): number {
  return v < VIRULENCE_MIN ? VIRULENCE_MIN : v > VIRULENCE_MAX ? VIRULENCE_MAX : v;
}

/**
 * How a strain's virulence raises the per-event transmission probability: linear
 * in virulence, so a more virulent strain is more contagious per contact.
 */
export function transmissionFactor(virulence: number, gain: number): number {
  return 1 + gain * virulence;
}

/**
 * How a strain's virulence shortens the infectious period: super-linear in
 * virulence (a quadratic harm term). Paired with the linear transmission rise
 * above, total expected onward transmission — transmission per tick times the
 * number of infectious ticks — peaks at an *intermediate* virulence (an interior
 * optimum), rather than ratcheting to the maximum (the de Roode result; only the
 * existence of an intermediate optimum is asserted, not its precise curvature).
 */
export function durationFactor(virulence: number, gain: number): number {
  return 1 / (1 + gain * virulence * virulence);
}

/** Fraction of the founding population seeded as patient zero when disease is on. */
export const INITIAL_INFECTED_FRACTION = 0.04;

/**
 * Seed the initial infection when disease is on: each live host is infected with
 * probability {@link INITIAL_INFECTED_FRACTION} (one seeded draw each), with a
 * guaranteed patient zero (the lowest live slot) so an epidemic can start even in
 * a small population. Draws no RNG and does nothing when disease is off, so the
 * default run is unchanged. Called once, after the founders are placed.
 */
export function seedInfections(world: World, params: SimulationParameters, rng: Rng): void {
  if (!params.disease) return;
  const { alive, infectionState, infectionTimer, virulence, agentCapacity } = world;
  const duration = infectionDuration(params.recoveryRate);
  const v0 = params.virulenceEvolves ? INITIAL_VIRULENCE : 0;
  let first = -1;
  let any = false;
  for (let s = 0; s < agentCapacity; s++) {
    if (alive[s] === 0) continue;
    if (first === -1) first = s;
    if (rng.next() < INITIAL_INFECTED_FRACTION) {
      infectionState[s] = INFECTED;
      infectionTimer[s] = duration;
      virulence[s] = v0;
      any = true;
    }
  }
  if (!any && first !== -1) {
    infectionState[first] = INFECTED;
    infectionTimer[first] = duration;
    virulence[first] = v0;
  }
}

/**
 * Disease (specification: Domain rules → Disease): an optional, default-off
 * compartmental (SIR/SIS) infection where transmission is density/contact-
 * dependent. Each tick, infected hosts infect susceptible grid neighbours via the
 * seeded generator; infection timers carry hosts to recovery (immunity SIR /
 * re-susceptibility SIS) or to disease death through the normal death path.
 *
 * Runs as its own pass after predation/metabolism, over current positions. A
 * reused object with bound visitors so the per-tick path allocates nothing, in
 * the style of {@link Predation}. When `params.disease` is off the pass draws no
 * RNG and touches nothing, so the default run is byte-for-byte unchanged.
 */
export class Disease {
  private world!: World;
  private rng!: Rng;
  private transmissionRate = 0;
  private resistanceCol!: Float32Array;

  /** Slots infected at the start of the tick (so newborn infections wait a tick). */
  private readonly infected: Int32Array;

  // Virulence-evolution state (set per step; inert when virulenceEvolves is off).
  private virulenceEvolves = false;
  private transmissionGain = 0;
  private harmGain = 0;
  private virulenceMutation = 0;
  private virulenceCol!: Float32Array;
  /** Virulence of the host currently transmitting (set before each grid query). */
  private transmitterVirulence = 0;
  /** Per-event transmission probability factor from the transmitter's virulence (1 when off). */
  private transmitFactor = 1;

  /** The susceptible-neighbour transmission visitor (bound once; no per-tick closure). */
  private readonly onNeighbour = (id: number, _dist2: number): void => {
    const w = this.world;
    if (w.alive[id] === 0 || w.infectionState[id] !== SUSCEPTIBLE) return;
    // One seeded draw per susceptible-in-radius (density-dependent βSI). Higher
    // host resistance lowers the effective transmission probability; with virulence
    // evolving, a more virulent strain transmits more readily (transmitFactor > 1).
    const guard = 1 - RESISTANCE_INFECTION_GUARD * this.resistanceCol[id];
    if (this.rng.next() < this.transmissionRate * guard * this.transmitFactor) {
      w.infectionState[id] = INFECTED;
      if (this.virulenceEvolves) {
        // The new host inherits the transmitter's virulence, perturbed by a seeded
        // clamped Gaussian step (the `breed`-style mutation) — the only extra RNG
        // draw versus the no-virulence pass, taken solely on a successful event.
        const v = clampVirulence(this.transmitterVirulence + this.rng.gaussian() * this.virulenceMutation);
        this.virulenceCol[id] = v;
        // Host harm: a more virulent strain shortens the infectious period.
        const dur = Math.round(this.duration * durationFactor(v, this.harmGain));
        w.infectionTimer[id] = dur < 1 ? 1 : dur;
      } else {
        w.infectionTimer[id] = this.duration;
      }
    }
  };

  private duration = 0;

  constructor(agentCapacity: number) {
    this.infected = new Int32Array(agentCapacity);
  }

  /**
   * Resolve disease for one tick; returns the number of disease deaths (routed
   * through `dropCarrion` + `world.killAgent`, exactly as `metaboliseAndReap`, so
   * carrion, records, and obituaries behave as for any other death). `agentGrid`
   * must already index the current live agents.
   */
  step(world: World, params: SimulationParameters, agentGrid: SpatialGrid, rng: Rng): number {
    if (!params.disease) return 0;
    this.world = world;
    this.rng = rng;
    this.transmissionRate = params.transmissionRate;
    this.resistanceCol = world.traits[RESISTANCE];
    this.duration = infectionDuration(params.recoveryRate);
    this.virulenceEvolves = params.virulenceEvolves;
    this.transmissionGain = params.virulenceTransmissionGain;
    this.harmGain = params.virulenceHarmGain;
    this.virulenceMutation = params.virulenceMutation;
    this.virulenceCol = world.virulence;
    // Default the per-event factor to 1 so a no-virulence pass is exactly 074
    // (the visitor only raises it inside the virulence-evolving branch).
    this.transmitFactor = 1;
    const { alive, infectionState, infectionTimer, virulence, x, y, agentCapacity } = world;

    // Snapshot the hosts infected at the start of the tick. Transmission below may
    // infect further slots, but those wait until the next tick to transmit or age,
    // keeping the pass order-independent and deterministic.
    let n = 0;
    for (let s = 0; s < agentCapacity; s++) {
      if (alive[s] === 1 && infectionState[s] === INFECTED) this.infected[n++] = s;
    }

    // 1. Transmission: each start-of-tick infected host infects susceptible
    //    neighbours within the transmission radius (one RNG draw per susceptible).
    for (let i = 0; i < n; i++) {
      const s = this.infected[i];
      if (this.virulenceEvolves) {
        this.transmitterVirulence = virulence[s];
        this.transmitFactor = transmissionFactor(virulence[s], this.transmissionGain);
      }
      agentGrid.query(x[s], y[s], TRANSMISSION_RADIUS, this.onNeighbour);
    }

    // 2. Advance timers; on expiry the host dies (with probability diseaseMortality,
    //    raised by the strain's virulence when evolving — more host harm) or recovers
    //    — to immune (SIR) or back to susceptible (SIS). One RNG draw per infection
    //    that ends, whether or not virulence evolves (the threshold changes, not the
    //    draw count), so with virulence off the stream matches the no-virulence pass.
    const sir = params.immunityMode !== 'sis';
    let deaths = 0;
    for (let i = 0; i < n; i++) {
      const s = this.infected[i];
      const t = infectionTimer[s];
      if (t > 1) {
        infectionTimer[s] = t - 1;
        continue;
      }
      // The infection ends this tick.
      infectionTimer[s] = 0;
      let mortality = params.diseaseMortality;
      if (this.virulenceEvolves) {
        mortality *= 1 + virulence[s];
        if (mortality > 1) mortality = 1;
      }
      if (rng.next() < mortality) {
        dropCarrion(world, x[s], y[s], world.traits[SIZE][s]);
        world.killAgent(s);
        deaths++;
      } else {
        infectionState[s] = sir ? RECOVERED : SUSCEPTIBLE;
        if (this.virulenceEvolves) virulence[s] = 0; // strain cleared
      }
    }
    return deaths;
  }
}
