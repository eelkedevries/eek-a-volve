import { TRAIT_COUNT } from './genome.ts';

/**
 * Byte layout of the world structure-of-arrays inside the shared WebAssembly
 * memory used by the optional WASM core (spec v0.4.4+). Columns start above
 * `DATA_BASE`, which the AssemblyScript kernels keep clear for their own stack and
 * static data. Columns are grouped by element size so typed-array views stay
 * aligned: 4-byte columns first, then the 2-byte `foodDecay`, then the 1-byte
 * columns and the kernels' death-scratch. The same offsets are used by `World` (to
 * place its views) and by the kernels (to read/write in place), so there is no
 * per-tick copy.
 */
export const DATA_BASE = 1 << 16;

export interface WorldLayout {
  // Agent 4-byte columns.
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  age: number;
  speciesId: number;
  id: number;
  parentId: number;
  generation: number;
  offspringCount: number;
  traits: number[];
  // Food 4-byte columns.
  foodX: number;
  foodY: number;
  foodEnergy: number;
  // Food 2-byte column.
  foodDecay: number;
  // 1-byte columns and death-scratches.
  alive: number;
  action: number;
  death: number;
  foodAlive: number;
  foodType: number;
  foodDeath: number;
  // Free-list stacks (Int32) and a small scalar-counts region (Int32), shared so
  // WASM allocation passes can pop/push and update counts in place.
  freeAgents: number;
  freeFood: number;
  counts: number;
  /** High-water byte offset; the shared memory must be at least this large. */
  byteLength: number;
}

/** Indices into the shared `counts` Int32 region (see WorldLayout.counts). */
export const COUNT_FREE_AGENT = 0;
export const COUNT_FREE_FOOD = 1;
export const COUNT_FOOD = 2;
export const COUNT_PLANT = 3;
export const COUNT_CARRION = 4;
export const COUNT_POPULATION = 5;
export const COUNT_NEXT_ID = 6;
export const COUNTS_LENGTH = 8;

/** Compute the world SoA byte layout for the given capacities. */
export function computeWorldLayout(agentCapacity: number, foodCapacity: number): WorldLayout {
  let o = DATA_BASE;
  const block = (count: number, bytes: number): number => {
    const at = o;
    o += count * bytes;
    return at;
  };
  // 4-byte columns.
  const x = block(agentCapacity, 4);
  const y = block(agentCapacity, 4);
  const vx = block(agentCapacity, 4);
  const vy = block(agentCapacity, 4);
  const energy = block(agentCapacity, 4);
  const age = block(agentCapacity, 4);
  const speciesId = block(agentCapacity, 4);
  const id = block(agentCapacity, 4);
  const parentId = block(agentCapacity, 4);
  const generation = block(agentCapacity, 4);
  const offspringCount = block(agentCapacity, 4);
  const traits: number[] = [];
  for (let t = 0; t < TRAIT_COUNT; t++) traits.push(block(agentCapacity, 4));
  const foodX = block(foodCapacity, 4);
  const foodY = block(foodCapacity, 4);
  const foodEnergy = block(foodCapacity, 4);
  // 2-byte column (offset stays 2-aligned: the 4-byte block ends 4-aligned).
  const foodDecay = block(foodCapacity, 2);
  // 1-byte columns and death-scratches.
  const alive = block(agentCapacity, 1);
  const action = block(agentCapacity, 1);
  const death = block(agentCapacity, 1);
  const foodAlive = block(foodCapacity, 1);
  const foodType = block(foodCapacity, 1);
  const foodDeath = block(foodCapacity, 1);
  // Re-align to 4 bytes for the Int32 free-lists and counts.
  o = (o + 3) & ~3;
  const freeAgents = block(agentCapacity, 4);
  const freeFood = block(foodCapacity, 4);
  const counts = block(COUNTS_LENGTH, 4);
  const byteLength = (o + 3) & ~3;
  return {
    x,
    y,
    vx,
    vy,
    energy,
    age,
    speciesId,
    id,
    parentId,
    generation,
    offspringCount,
    traits,
    foodX,
    foodY,
    foodEnergy,
    foodDecay,
    alive,
    action,
    death,
    foodAlive,
    foodType,
    foodDeath,
    freeAgents,
    freeFood,
    counts,
    byteLength,
  };
}

/** Byte offsets of the two spatial grids' backing arrays in the shared memory,
 *  laid out after the world SoA (`base` = its byteLength). */
export interface GridLayout {
  agentHead: number;
  agentNext: number;
  agentItemX: number;
  agentItemY: number;
  foodHead: number;
  foodNext: number;
  foodItemX: number;
  foodItemY: number;
  /** Trait ranges as f64 pairs [min0, max0, …] for the mutation kernel. */
  ranges: number;
  /** SPECIES_TRAIT_COUNT f64 scratch for the self-genome (mate compatibility). */
  selfNorm: number;
  // Behaviour scratch/output (Int32 unless noted).
  live: number;
  newborns: number;
  freakBirths: number;
  /** [births, newbornCount, freakBirthCount]. */
  outputs: number;
  /** Int32 table of column/grid offsets the behaviour kernel reads (see metabolismCore). */
  config: number;
  /** Per-agent "mated this tick" flags (Uint8). */
  mated: number;
  byteLength: number;
}

/** Number of Int32 entries in the behaviour kernel's config table. */
export const CONFIG_LENGTH = 40;
/** f64 scratch length for the self-genome (= SPECIES_TRAIT_COUNT). */
const SELF_NORM_LENGTH = 6;

/** Lay out the agent and food grids (Int32/Float32) plus the f64 trait ranges from `base`. */
export function computeGridLayout(
  base: number,
  gridCells: number,
  agentCapacity: number,
  foodCapacity: number,
): GridLayout {
  let o = (base + 3) & ~3;
  const block = (count: number): number => {
    const at = o;
    o += count * 4;
    return at;
  };
  const agentHead = block(gridCells);
  const agentNext = block(agentCapacity);
  const agentItemX = block(agentCapacity);
  const agentItemY = block(agentCapacity);
  const foodHead = block(gridCells);
  const foodNext = block(foodCapacity);
  const foodItemX = block(foodCapacity);
  const foodItemY = block(foodCapacity);
  // f64 regions (8-byte aligned): trait ranges, then the self-genome scratch.
  o = (o + 7) & ~7;
  const ranges = o;
  o += TRAIT_COUNT * 2 * 8;
  const selfNorm = o;
  o += SELF_NORM_LENGTH * 8;
  // Int32 behaviour scratch/output and the config table.
  const live = block(agentCapacity);
  const newborns = block(agentCapacity);
  const freakBirths = block(agentCapacity);
  const outputs = block(4);
  const config = block(CONFIG_LENGTH);
  // Uint8 per-agent mated flags.
  const mated = o;
  o += agentCapacity;
  return {
    agentHead,
    agentNext,
    agentItemX,
    agentItemY,
    foodHead,
    foodNext,
    foodItemX,
    foodItemY,
    ranges,
    selfNorm,
    live,
    newborns,
    freakBirths,
    outputs,
    config,
    mated,
    byteLength: (o + 7) & ~7,
  };
}
