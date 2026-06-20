import { TRAIT_COUNT } from './genome.ts';

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
  /** Generations from a founder/immigrant (0 = founder). */
  readonly generation: Uint32Array;
  /** Number of offspring this creature has produced. */
  readonly offspringCount: Uint32Array;
  /** What the agent is doing this tick (see `state.ts`). */
  readonly action: Uint8Array;

  // Food columns, indexed by slot.
  readonly foodX: Float32Array;
  readonly foodY: Float32Array;
  readonly foodAlive: Uint8Array;

  population = 0;
  foodCount = 0;

  private nextId = 1;
  private readonly freeAgents: Int32Array;
  private freeAgentCount: number;
  private readonly freeFood: Int32Array;
  private freeFoodCount: number;

  constructor(agentCapacity: number, foodCapacity: number) {
    this.agentCapacity = agentCapacity;
    this.foodCapacity = foodCapacity;

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
    this.generation = new Uint32Array(agentCapacity);
    this.offspringCount = new Uint32Array(agentCapacity);
    this.action = new Uint8Array(agentCapacity);

    this.foodX = new Float32Array(foodCapacity);
    this.foodY = new Float32Array(foodCapacity);
    this.foodAlive = new Uint8Array(foodCapacity);

    // Free-lists used as stacks; every slot starts free.
    this.freeAgents = new Int32Array(agentCapacity);
    for (let i = 0; i < agentCapacity; i++) this.freeAgents[i] = i;
    this.freeAgentCount = agentCapacity;

    this.freeFood = new Int32Array(foodCapacity);
    for (let i = 0; i < foodCapacity; i++) this.freeFood[i] = i;
    this.freeFoodCount = foodCapacity;
  }

  /** Allocate an agent slot (resetting age, marking alive), or -1 if at capacity. */
  spawnAgent(): number {
    if (this.freeAgentCount === 0) return -1;
    const slot = this.freeAgents[--this.freeAgentCount];
    this.alive[slot] = 1;
    this.age[slot] = 0;
    this.id[slot] = this.nextId++;
    this.generation[slot] = 0;
    this.offspringCount[slot] = 0;
    this.action[slot] = 0;
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
    this.freeFood[this.freeFoodCount++] = slot;
    this.foodCount--;
  }
}
