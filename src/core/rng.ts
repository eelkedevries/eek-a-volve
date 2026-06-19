/**
 * Deterministic pseudo-random number generator (mulberry32).
 *
 * A small, fast 32-bit generator seeded from a single integer. Every stochastic
 * decision in the simulation draws from this so that a given seed reproduces a
 * run exactly; the unseeded platform `Math.random` is never used on the
 * simulation path (specification: Domain rules → Determinism).
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Coerce to a 32-bit unsigned integer so any finite seed is valid.
    this.state = seed >>> 0;
  }

  /** Next float in the half-open interval [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    const a = this.state;
    let t = a ^ (a >>> 15);
    t = Math.imul(t, 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in the half-open interval [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Standard-normal sample (mean 0, variance 1) via the Box–Muller transform. */
  gaussian(): number {
    let u1 = this.next();
    if (u1 < 1e-12) u1 = 1e-12; // avoid log(0)
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}
