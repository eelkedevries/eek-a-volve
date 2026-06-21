import type { World } from './world.ts';

/**
 * Uniform spatial grid for neighbour queries within a radius.
 *
 * Items (agent or food slots) are bucketed into fixed cells using an
 * allocation-free per-cell linked list: `head[cell]` is the first item, and
 * `next[id]` chains the rest. Rebuilding each tick only refills these arrays —
 * nothing on the per-tick path allocates (specification: Architecture).
 */
export class SpatialGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;

  private readonly head: Int32Array;
  private readonly next: Int32Array;
  private readonly itemX: Float32Array;
  private readonly itemY: Float32Array;

  /**
   * @param shared When given (WASM core on), the backing arrays are views over the
   * shared memory so a WASM behaviour pass can query the grid in place; otherwise
   * they are freshly allocated. Build and query are identical either way.
   */
  constructor(
    width: number,
    height: number,
    cellSize: number,
    capacity: number,
    shared?: { head: Int32Array; next: Int32Array; itemX: Float32Array; itemY: Float32Array },
  ) {
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    if (shared !== undefined) {
      this.head = shared.head;
      this.next = shared.next;
      this.itemX = shared.itemX;
      this.itemY = shared.itemY;
    } else {
      this.head = new Int32Array(this.cols * this.rows);
      this.next = new Int32Array(capacity);
      this.itemX = new Float32Array(capacity);
      this.itemY = new Float32Array(capacity);
    }
    this.clear();
  }

  /** Empty every cell. */
  clear(): void {
    this.head.fill(-1);
  }

  /** Insert item `id` at position (x, y). */
  insert(id: number, x: number, y: number): void {
    this.itemX[id] = x;
    this.itemY[id] = y;
    const c = this.cellOf(x, y);
    this.next[id] = this.head[c];
    this.head[c] = id;
  }

  /** Clear and repopulate from a World's live agents. */
  rebuildFromAgents(world: World): void {
    this.clear();
    const { alive, x, y, agentCapacity } = world;
    for (let s = 0; s < agentCapacity; s++) {
      if (alive[s] === 1) this.insert(s, x[s], y[s]);
    }
  }

  /**
   * Visit every inserted item within `radius` of (px, py). `visit` receives the
   * item id and the squared distance. Visit order is deterministic for a given
   * set of inserts.
   */
  query(
    px: number,
    py: number,
    radius: number,
    visit: (id: number, dist2: number) => void,
  ): void {
    const r2 = radius * radius;
    const cs = this.cellSize;
    const minCx = clamp(Math.floor((px - radius) / cs), 0, this.cols - 1);
    const maxCx = clamp(Math.floor((px + radius) / cs), 0, this.cols - 1);
    const minCy = clamp(Math.floor((py - radius) / cs), 0, this.rows - 1);
    const maxCy = clamp(Math.floor((py + radius) / cs), 0, this.rows - 1);
    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowBase = cy * this.cols;
      for (let cx = minCx; cx <= maxCx; cx++) {
        let id = this.head[rowBase + cx];
        while (id !== -1) {
          const dx = px - this.itemX[id];
          const dy = py - this.itemY[id];
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2) visit(id, d2);
          id = this.next[id];
        }
      }
    }
  }

  private cellOf(x: number, y: number): number {
    const cx = clamp(Math.floor(x / this.cellSize), 0, this.cols - 1);
    const cy = clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
    return cy * this.cols + cx;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
