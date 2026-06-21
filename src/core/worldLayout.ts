import { TRAIT_COUNT } from './genome.ts';

/**
 * Byte layout of the agent structure-of-arrays inside the shared WebAssembly
 * memory used by the optional WASM core (spec v0.4.4). Columns start above
 * `DATA_BASE`, which the AssemblyScript kernel keeps clear for its own stack and
 * static data. The 4-byte columns are laid out first (so their offsets are
 * 4-aligned for typed-array views), then the 1-byte columns, then a 1-byte
 * death-scratch the metabolism kernel writes. Same offsets are used by `World`
 * (to place its views) and by the kernel (to read/write in place), so there is no
 * per-tick copy.
 */
export const DATA_BASE = 1 << 16;

export interface AgentLayout {
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
  /** Byte offset of each trait column, in `TRAITS` order. */
  traits: number[];
  alive: number;
  action: number;
  death: number;
  /** High-water byte offset; the shared memory must be at least this large. */
  byteLength: number;
}

/** Compute the agent-SoA byte layout for a given capacity. */
export function computeAgentLayout(agentCapacity: number): AgentLayout {
  const f = agentCapacity * 4;
  let o = DATA_BASE;
  const next4 = (): number => {
    const at = o;
    o += f;
    return at;
  };
  const x = next4();
  const y = next4();
  const vx = next4();
  const vy = next4();
  const energy = next4();
  const age = next4();
  const speciesId = next4();
  const id = next4();
  const parentId = next4();
  const generation = next4();
  const offspringCount = next4();
  const traits: number[] = [];
  for (let t = 0; t < TRAIT_COUNT; t++) traits.push(next4());
  const nextB = (): number => {
    const at = o;
    o += agentCapacity;
    return at;
  };
  const alive = nextB();
  const action = nextB();
  const death = nextB();
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
    alive,
    action,
    death,
    byteLength,
  };
}
