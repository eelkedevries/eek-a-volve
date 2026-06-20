/**
 * A coarse, static fertility field over the world (specification: Domain rules →
 * Population bounds). It is a pure, deterministic function of position and seed,
 * returning a weight in [0, 1], so the worker (which biases food regeneration by
 * it) and the renderer (which tints the background by it) compute the same field
 * independently without sharing a buffer. Closed-form and allocation-free.
 */

const TWO_PI = Math.PI * 2;

/** Deterministic hash of an integer to a float in [0, 1). */
function hash01(n: number): number {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Fertility at world position (x, y), in [0, 1]. A sum of three seeded,
 * low-frequency sinusoidal patches gives smooth regions of plenty and scarcity;
 * the spatial mean is approximately 0.5, so total food (the carrying capacity)
 * is unchanged — only where it lands shifts.
 */
export function fertilityAt(
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
): number {
  const u = x / (width > 0 ? width : 1);
  const v = y / (height > 0 ? height : 1);
  let f = 0;
  for (let k = 0; k < 3; k++) {
    const base = (seed * 4 + k * 8) | 0;
    const fx = 1 + Math.floor(hash01(base + 1) * 3); // 1..3 cycles across the world
    const fy = 1 + Math.floor(hash01(base + 2) * 3);
    const px = hash01(base + 3) * TWO_PI;
    const py = hash01(base + 4) * TWO_PI;
    f += Math.sin(u * fx * TWO_PI + px) * Math.cos(v * fy * TWO_PI + py);
  }
  return clamp01((f / 3) * 0.5 + 0.5);
}
