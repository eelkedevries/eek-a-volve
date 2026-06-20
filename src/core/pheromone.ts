/**
 * A coarse, decaying, diffusing scalar pheromone field over the world
 * (specification: Domain rules → Stigmergy). Creatures deposit into the cell
 * beneath them when they eat, and bias their wandering up the local gradient
 * when no food is sensed.
 *
 * The field is a single `Float32Array` sized from the world dimensions and a
 * cell size, with a second buffer used by the diffusion step; both are allocated
 * once at construction and reused, so nothing on the per-tick path allocates
 * (specification: Architecture). The decay/diffusion step is purely arithmetic
 * and therefore deterministic.
 */

/** Below this gradient magnitude a cell is treated as having no usable trail. */
export const PHEROMONE_GRADIENT_EPSILON = 1e-6;

export class PheromoneField {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  /** Pheromone level per cell, row-major (`cy * cols + cx`). */
  readonly field: Float32Array;
  private readonly scratch: Float32Array;

  /** Gradient (direction of increasing pheromone) at the last sampled point. */
  gradX = 0;
  gradY = 0;

  constructor(width: number, height: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    this.field = new Float32Array(this.cols * this.rows);
    this.scratch = new Float32Array(this.cols * this.rows);
  }

  /** Reset the field to empty. */
  clear(): void {
    this.field.fill(0);
  }

  private cellOf(x: number, y: number): number {
    const cx = clampIdx(Math.floor(x / this.cellSize), this.cols);
    const cy = clampIdx(Math.floor(y / this.cellSize), this.rows);
    return cy * this.cols + cx;
  }

  /** Deposit `amount` into the cell beneath (x, y). */
  deposit(x: number, y: number, amount: number): void {
    this.field[this.cellOf(x, y)] += amount;
  }

  /** Pheromone level at (x, y). */
  sample(x: number, y: number): number {
    return this.field[this.cellOf(x, y)];
  }

  /**
   * Advance the field by one tick: blend each cell a fraction `diffusion`
   * (0..1) toward the mean of its four orthogonal neighbours, then scale by the
   * multiplicative `decay` (0..1). Reads `field`, writes `scratch`, then copies
   * back, so the result is order-independent and deterministic, and no
   * allocation occurs.
   */
  step(decay: number, diffusion: number): void {
    const { field, scratch, cols, rows } = this;
    for (let cy = 0; cy < rows; cy++) {
      const row = cy * cols;
      for (let cx = 0; cx < cols; cx++) {
        const i = row + cx;
        const self = field[i];
        // Edge cells reuse their own value for any neighbour off the grid.
        const left = cx > 0 ? field[i - 1] : self;
        const right = cx < cols - 1 ? field[i + 1] : self;
        const up = cy > 0 ? field[i - cols] : self;
        const down = cy < rows - 1 ? field[i + cols] : self;
        const mean = (left + right + up + down) * 0.25;
        scratch[i] = (self + (mean - self) * diffusion) * decay;
      }
    }
    field.set(scratch);
  }

  /**
   * Compute the local gradient (direction of increasing pheromone) at (x, y) by
   * central differences over neighbouring cells, storing it in `gradX`/`gradY`.
   * Returns the gradient magnitude; callers treat a magnitude below
   * {@link PHEROMONE_GRADIENT_EPSILON} as "no trail here".
   */
  sampleGradient(x: number, y: number): number {
    const { field, cols, rows } = this;
    const cx = clampIdx(Math.floor(x / this.cellSize), cols);
    const cy = clampIdx(Math.floor(y / this.cellSize), rows);
    const i = cy * cols + cx;
    const here = field[i];
    const left = cx > 0 ? field[i - 1] : here;
    const right = cx < cols - 1 ? field[i + 1] : here;
    const up = cy > 0 ? field[i - cols] : here;
    const down = cy < rows - 1 ? field[i + cols] : here;
    this.gradX = right - left;
    this.gradY = down - up;
    return Math.abs(this.gradX) + Math.abs(this.gradY);
  }
}

function clampIdx(v: number, n: number): number {
  return v < 0 ? 0 : v >= n ? n - 1 : v;
}
