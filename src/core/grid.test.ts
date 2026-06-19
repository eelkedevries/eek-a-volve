import { describe, it, expect } from 'vitest';
import { SpatialGrid } from './grid.ts';
import { World } from './world.ts';

function collect(g: SpatialGrid, px: number, py: number, r: number): number[] {
  const out: number[] = [];
  g.query(px, py, r, (id) => out.push(id));
  return out.sort((a, b) => a - b);
}

describe('SpatialGrid', () => {
  it('returns exactly the points within the radius', () => {
    const g = new SpatialGrid(100, 100, 10, 8);
    const pts: [number, number][] = [
      [5, 5], // 0
      [15, 5], // 1 — 10 away
      [5, 15], // 2 — 10 away
      [50, 50], // 3 — far
      [95, 95], // 4 — far
    ];
    pts.forEach(([x, y], i) => g.insert(i, x, y));
    expect(collect(g, 5, 5, 12)).toEqual([0, 1, 2]);
  });

  it('includes the radius boundary but excludes just beyond it', () => {
    const g = new SpatialGrid(100, 100, 10, 4);
    g.insert(0, 0, 0);
    g.insert(1, 10, 0);
    expect(collect(g, 0, 0, 9.9)).toEqual([0]);
    expect(collect(g, 0, 0, 10)).toEqual([0, 1]);
  });

  it('handles points on the world edge', () => {
    const g = new SpatialGrid(100, 100, 16, 4);
    g.insert(0, 99.9, 99.9);
    g.insert(1, 0, 0);
    expect(collect(g, 100, 100, 5)).toEqual([0]);
    expect(collect(g, 0, 0, 5)).toEqual([1]);
  });

  it('is deterministic across rebuilds', () => {
    const order = (): number[] => {
      const g = new SpatialGrid(100, 100, 10, 32);
      for (let i = 0; i < 20; i++) g.insert(i, (i * 7) % 100, (i * 13) % 100);
      const out: number[] = [];
      g.query(50, 50, 40, (id) => out.push(id));
      return out;
    };
    expect(order()).toEqual(order());
  });

  it('rebuilds from a World and excludes dead agents', () => {
    const w = new World(10, 1);
    const a = w.spawnAgent();
    const b = w.spawnAgent();
    const c = w.spawnAgent();
    w.x[a] = 10; w.y[a] = 10;
    w.x[b] = 80; w.y[b] = 80;
    w.x[c] = 12; w.y[c] = 12;
    w.killAgent(b);
    const g = new SpatialGrid(100, 100, 16, w.agentCapacity);
    g.rebuildFromAgents(w);
    expect(collect(g, 11, 11, 5)).toEqual([a, c].sort((x, y) => x - y));
  });
});
