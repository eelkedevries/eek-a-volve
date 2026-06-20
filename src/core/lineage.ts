import type { World } from './world.ts';

/** Number of recent `id → parent` links the registry remembers. */
export const LINEAGE_CAPACITY = 16384;

/** How many ancestors deep an ancestry chain is resolved for display. */
export const MAX_ANCESTRY = 8;

/**
 * A bounded record of recent `id → parentId` links, used only to display a
 * creature's ancestry in the inspector. It is observational metadata and never
 * affects a simulation decision (specification: Domain rules → lineage).
 *
 * Implemented as a fixed-capacity ring keyed by id: a creature's record lives in
 * slot `id % capacity`, overwriting whatever older id shared that slot. A lookup
 * for an evicted id returns 0 ("unknown"), so an ancestry chain simply stops
 * early rather than reporting a wrong parent. Pre-allocated; `record` allocates
 * nothing, and the structure never grows.
 */
export class LineageRegistry {
  readonly capacity: number;
  private readonly ids: Uint32Array;
  private readonly parents: Uint32Array;

  constructor(capacity: number = LINEAGE_CAPACITY) {
    this.capacity = capacity;
    this.ids = new Uint32Array(capacity);
    this.parents = new Uint32Array(capacity);
  }

  /** Remember that `id` was born to `parentId`. */
  record(id: number, parentId: number): void {
    const i = id % this.capacity;
    this.ids[i] = id;
    this.parents[i] = parentId;
  }

  /** The recorded parent id for `id`, or 0 if unknown / evicted / a founder. */
  parentOf(id: number): number {
    if (id === 0) return 0;
    const i = id % this.capacity;
    return this.ids[i] === id ? this.parents[i] : 0;
  }

  /** Forget everything. */
  clear(): void {
    this.ids.fill(0);
    this.parents.fill(0);
  }
}

/** The live slot holding `id`, or -1 if no living creature has it. */
function slotOfId(world: World, id: number): number {
  if (id === 0) return -1;
  const { alive, id: ids, agentCapacity } = world;
  for (let s = 0; s < agentCapacity; s++) if (alive[s] === 1 && ids[s] === id) return s;
  return -1;
}

/**
 * The ancestry chain of `id` — ancestor ids nearest-first (parent, grandparent,
 * …), excluding the creature itself — resolved up to `maxDepth`. Each hop prefers
 * the authoritative `parentId` column for a living ancestor and falls back to the
 * bounded registry for one that has died; the chain stops at a founder (parent 0)
 * or an evicted/unknown id. Walks at most `maxDepth` ancestors, so the small array
 * here is bounded; this is the on-demand inspect path, not the per-tick path.
 */
export function resolveAncestry(
  world: World,
  registry: LineageRegistry,
  id: number,
  maxDepth: number = MAX_ANCESTRY,
): number[] {
  const chain: number[] = [];
  let cur = id;
  for (let d = 0; d < maxDepth; d++) {
    const slot = slotOfId(world, cur);
    const parent = slot !== -1 ? world.parentId[slot] : registry.parentOf(cur);
    if (parent === 0) break;
    chain.push(parent);
    cur = parent;
  }
  return chain;
}
