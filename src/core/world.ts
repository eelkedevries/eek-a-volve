import { TRAIT_COUNT } from './genome.ts';
import {
  computeWorldLayout,
  COUNT_FREE_AGENT,
  COUNT_FREE_FOOD,
  COUNT_FOOD,
  COUNT_PLANT,
  COUNT_CARRION,
  COUNT_POPULATION,
  COUNT_NEXT_ID,
} from './worldLayout.ts';

/**
 * Structure-of-arrays world state.
 *
 * Position, velocity, energy, age, species, and the genome traits are held in
 * parallel typed arrays indexed by a stable agent slot. Agent and food slots
 * are drawn from pre-allocated pools and reused on death and birth, so nothing
 * on the per-tick path allocates (specification: Data schemas). Live agents are
 * iterated by scanning the `alive` flag over `[0, agentCapacity)`.
 */
export class World {
  readonly agentCapacity: number;
  readonly foodCapacity: number;

  // Agent columns, indexed by slot.
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly energy: Float32Array;
  readonly age: Uint32Array;
  readonly speciesId: Int32Array;
  readonly alive: Uint8Array;
  /** Genome traits, one column array per trait, in `TRAITS` order. */
  readonly traits: Float32Array[];

  /** Stable per-creature identity (a reused slot gets a new id). 0 means none. */
  readonly id: Uint32Array;
  /** Stable id of this creature's parent (0 = founder/immigrant). Observational only. */
  readonly parentId: Uint32Array;
  /** Generations from a founder/immigrant (0 = founder). */
  readonly generation: Uint32Array;
  /** Number of offspring this creature has produced. */
  readonly offspringCount: Uint32Array;
  /** What the agent is doing this tick (see `state.ts`). */
  readonly action: Uint8Array;

  /** Infection compartment: 0 = susceptible, 1 = infected, 2 = recovered/immune
   *  (the optional disease coupling, v0.6.0; always 0 when disease is off). */
  readonly infectionState: Uint8Array;
  /** Ticks remaining in the current infection (meaningful only while infected). */
  readonly infectionTimer: Uint16Array;

  /** Per-creature neural-net weights (optional capability); null when brains are off. */
  brainWeights: Float32Array | null = null;

  // Food columns, indexed by slot.
  readonly foodX: Float32Array;
  readonly foodY: Float32Array;
  readonly foodAlive: Uint8Array;
  /** Food type per slot: 0 = plant, 1 = carrion. */
  readonly foodType: Uint8Array;
  /** Energy yielded by eating this food item. */
  readonly foodEnergy: Float32Array;
  /** Ticks of decay remaining for carrion (ignored for plants). */
  readonly foodDecay: Uint16Array;

  population = 0;
  foodCount = 0;
  plantCount = 0;
  carrionCount = 0;

  private nextId = 1;
  private readonly freeAgents: Int32Array;
  private freeAgentCount: number;
  private readonly freeFood: Int32Array;
  private freeFoodCount: number;

  /**
   * @param sharedBuffer When given (WASM core on), the agent columns are placed as
   * views over this shared buffer at the {@link computeAgentLayout} offsets, so the
   * WASM kernels operate on them in place. Omitted (default), each column is a fresh
   * typed array exactly as before — the default path is unchanged.
   */
  constructor(agentCapacity: number, foodCapacity: number, sharedBuffer?: ArrayBuffer) {
    this.agentCapacity = agentCapacity;
    this.foodCapacity = foodCapacity;

    if (sharedBuffer !== undefined) {
      const L = computeWorldLayout(agentCapacity, foodCapacity);
      this.x = new Float32Array(sharedBuffer, L.x, agentCapacity);
      this.y = new Float32Array(sharedBuffer, L.y, agentCapacity);
      this.vx = new Float32Array(sharedBuffer, L.vx, agentCapacity);
      this.vy = new Float32Array(sharedBuffer, L.vy, agentCapacity);
      this.energy = new Float32Array(sharedBuffer, L.energy, agentCapacity);
      this.age = new Uint32Array(sharedBuffer, L.age, agentCapacity);
      this.speciesId = new Int32Array(sharedBuffer, L.speciesId, agentCapacity);
      this.alive = new Uint8Array(sharedBuffer, L.alive, agentCapacity);
      this.traits = L.traits.map((off) => new Float32Array(sharedBuffer, off, agentCapacity));
      this.id = new Uint32Array(sharedBuffer, L.id, agentCapacity);
      this.parentId = new Uint32Array(sharedBuffer, L.parentId, agentCapacity);
      this.generation = new Uint32Array(sharedBuffer, L.generation, agentCapacity);
      this.offspringCount = new Uint32Array(sharedBuffer, L.offspringCount, agentCapacity);
      this.action = new Uint8Array(sharedBuffer, L.action, agentCapacity);
      this.infectionState = new Uint8Array(sharedBuffer, L.infectionState, agentCapacity);
      this.infectionTimer = new Uint16Array(sharedBuffer, L.infectionTimer, agentCapacity);
      this.foodX = new Float32Array(sharedBuffer, L.foodX, foodCapacity);
      this.foodY = new Float32Array(sharedBuffer, L.foodY, foodCapacity);
      this.foodEnergy = new Float32Array(sharedBuffer, L.foodEnergy, foodCapacity);
      this.foodDecay = new Uint16Array(sharedBuffer, L.foodDecay, foodCapacity);
      this.foodAlive = new Uint8Array(sharedBuffer, L.foodAlive, foodCapacity);
      this.foodType = new Uint8Array(sharedBuffer, L.foodType, foodCapacity);
    } else {
      this.x = new Float32Array(agentCapacity);
      this.y = new Float32Array(agentCapacity);
      this.vx = new Float32Array(agentCapacity);
      this.vy = new Float32Array(agentCapacity);
      this.energy = new Float32Array(agentCapacity);
      this.age = new Uint32Array(agentCapacity);
      this.speciesId = new Int32Array(agentCapacity);
      this.alive = new Uint8Array(agentCapacity);
      this.traits = Array.from({ length: TRAIT_COUNT }, () => new Float32Array(agentCapacity));
      this.id = new Uint32Array(agentCapacity);
      this.parentId = new Uint32Array(agentCapacity);
      this.generation = new Uint32Array(agentCapacity);
      this.offspringCount = new Uint32Array(agentCapacity);
      this.action = new Uint8Array(agentCapacity);
      this.infectionState = new Uint8Array(agentCapacity);
      this.infectionTimer = new Uint16Array(agentCapacity);
      this.foodX = new Float32Array(foodCapacity);
      this.foodY = new Float32Array(foodCapacity);
      this.foodEnergy = new Float32Array(foodCapacity);
      this.foodDecay = new Uint16Array(foodCapacity);
      this.foodAlive = new Uint8Array(foodCapacity);
      this.foodType = new Uint8Array(foodCapacity);
    }

    // Free-lists used as stacks; every slot starts free. Shared with the WASM core
    // when a shared buffer is given, so its allocation passes pop/push in place.
    if (sharedBuffer !== undefined) {
      const L = computeWorldLayout(agentCapacity, foodCapacity);
      this.freeAgents = new Int32Array(sharedBuffer, L.freeAgents, agentCapacity);
      this.freeFood = new Int32Array(sharedBuffer, L.freeFood, foodCapacity);
    } else {
      this.freeAgents = new Int32Array(agentCapacity);
      this.freeFood = new Int32Array(foodCapacity);
    }
    for (let i = 0; i < agentCapacity; i++) this.freeAgents[i] = i;
    this.freeAgentCount = agentCapacity;
    for (let i = 0; i < foodCapacity; i++) this.freeFood[i] = i;
    this.freeFoodCount = foodCapacity;
  }

  /** Copy the scalar counts into the WASM core's shared counts region (before a pass). */
  writeCounts(counts: Int32Array): void {
    counts[COUNT_FREE_AGENT] = this.freeAgentCount;
    counts[COUNT_FREE_FOOD] = this.freeFoodCount;
    counts[COUNT_FOOD] = this.foodCount;
    counts[COUNT_PLANT] = this.plantCount;
    counts[COUNT_CARRION] = this.carrionCount;
    counts[COUNT_POPULATION] = this.population;
    counts[COUNT_NEXT_ID] = this.nextId;
  }

  /** Read the scalar counts back from the shared counts region (after a pass). */
  readCounts(counts: Int32Array): void {
    this.freeAgentCount = counts[COUNT_FREE_AGENT];
    this.freeFoodCount = counts[COUNT_FREE_FOOD];
    this.foodCount = counts[COUNT_FOOD];
    this.plantCount = counts[COUNT_PLANT];
    this.carrionCount = counts[COUNT_CARRION];
    this.population = counts[COUNT_POPULATION];
    this.nextId = counts[COUNT_NEXT_ID];
  }

  /** Allocate the per-creature brain-weight store (optional capability). Called once. */
  enableBrains(weightCount: number): void {
    this.brainWeights = new Float32Array(this.agentCapacity * weightCount);
  }

  /** Allocate an agent slot (resetting age, marking alive), or -1 if at capacity. */
  spawnAgent(): number {
    if (this.freeAgentCount === 0) return -1;
    const slot = this.freeAgents[--this.freeAgentCount];
    this.alive[slot] = 1;
    this.age[slot] = 0;
    this.id[slot] = this.nextId++;
    this.parentId[slot] = 0;
    this.generation[slot] = 0;
    this.offspringCount[slot] = 0;
    this.action[slot] = 0;
    // A reused slot starts susceptible with no infection timer, so disease state
    // never carries over from the slot's previous occupant.
    this.infectionState[slot] = 0;
    this.infectionTimer[slot] = 0;
    this.population++;
    return slot;
  }

  /** Free an agent slot for reuse. No-op if the slot is already dead. */
  killAgent(slot: number): void {
    if (this.alive[slot] === 0) return;
    this.alive[slot] = 0;
    this.freeAgents[this.freeAgentCount++] = slot;
    this.population--;
  }

  /** Allocate a food slot, or -1 if at capacity. */
  spawnFood(): number {
    if (this.freeFoodCount === 0) return -1;
    const slot = this.freeFood[--this.freeFoodCount];
    this.foodAlive[slot] = 1;
    this.foodCount++;
    return slot;
  }

  /** Free a food slot for reuse. No-op if the slot is already empty. */
  killFood(slot: number): void {
    if (this.foodAlive[slot] === 0) return;
    this.foodAlive[slot] = 0;
    if (this.foodType[slot] === 0) this.plantCount--;
    else this.carrionCount--;
    this.freeFood[this.freeFoodCount++] = slot;
    this.foodCount--;
  }
}
