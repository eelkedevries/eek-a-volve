import { describe, it, expect } from 'vitest';
import { Rng } from './rng.ts';

describe('Rng (mulberry32)', () => {
  it('reproduces a fixed known sequence for a given seed', () => {
    const rng = new Rng(42);
    const seq = [rng.next(), rng.next(), rng.next(), rng.next(), rng.next()];
    expect(seq).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
      0.6697340414393693, 0.17481389874592423,
    ]);
  });

  it('is deterministic: equal seeds give identical sequences', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('diverges for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const sa = Array.from({ length: 10 }, () => a.next());
    const sb = Array.from({ length: 10 }, () => b.next());
    expect(sa).not.toEqual(sb);
  });

  it('returns floats in [0, 1)', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range(min, max) stays within [min, max)', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 10000; i++) {
      const v = rng.range(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
    }
  });

  it('int(n) returns an integer in [0, n)', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 10000; i++) {
      const v = rng.int(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });

  it('gaussian() approximates N(0, 1)', () => {
    const rng = new Rng(2024);
    const n = 100000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const g = rng.gaussian();
      sum += g;
      sumSq += g * g;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(variance - 1)).toBeLessThan(0.05);
  });

  it('gaussian() is deterministic for a given seed', () => {
    const a = new Rng(9);
    const b = new Rng(9);
    for (let i = 0; i < 100; i++) expect(a.gaussian()).toBe(b.gaussian());
  });
});
