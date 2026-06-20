import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SIZE } from './genome.ts';
import { Records } from './records.ts';

/** Spawn `n` agents and return their slots (ids are auto-assigned). */
function spawn(w: World, n: number): number[] {
  const slots: number[] = [];
  for (let i = 0; i < n; i++) slots.push(w.spawnAgent());
  return slots;
}

describe('Records', () => {
  it('tracks the oldest, biggest, most-prolific, deepest lineage, peak, and Elder', () => {
    const w = new World(8, 8);
    const [a, b, c] = spawn(w, 3);
    w.age[a] = 10;
    w.age[b] = 50;
    w.age[c] = 30;
    w.traits[SIZE][a] = 1.0;
    w.traits[SIZE][b] = 1.5;
    w.traits[SIZE][c] = 2.0;
    w.offspringCount[a] = 2;
    w.offspringCount[c] = 5;
    w.generation[a] = 3;
    w.generation[c] = 7;

    const r = new Records();
    r.update(w, 100);
    const v = r.view();

    expect(v.oldest.value).toBe(50);
    expect(v.oldest.id).toBe(w.id[b]);
    expect(v.biggest.value).toBeCloseTo(2.0);
    expect(v.biggest.id).toBe(w.id[c]);
    expect(v.mostOffspring.value).toBe(5);
    expect(v.mostOffspring.id).toBe(w.id[c]);
    expect(v.longestBloodline.value).toBe(7);
    expect(v.longestBloodline.id).toBe(w.id[c]);
    expect(v.peakPopulation.value).toBe(3);
    expect(v.reigningElder.id).toBe(w.id[b]);
    expect(v.reigningElder.age).toBe(50);
  });

  it('keeps all-time records after the holder dies, but updates the reigning Elder', () => {
    const w = new World(8, 8);
    const [a, b, c] = spawn(w, 3);
    w.age[a] = 10;
    w.age[b] = 50;
    w.age[c] = 30;
    const r = new Records();
    r.update(w, 100);

    w.killAgent(b); // the oldest dies
    r.update(w, 200);
    const v = r.view();

    expect(v.oldest.value).toBe(50); // all-time record persists past death
    expect(v.oldest.id).toBe(w.id[b]);
    expect(v.peakPopulation.value).toBe(3); // peaked at 3, even though 2 remain now
    expect(v.reigningElder.alive).toBe(true);
    expect(v.reigningElder.id).toBe(w.id[c]); // c (age 30) is now the oldest alive
    expect(v.reigningElder.age).toBe(30);
  });

  it('reports no reigning Elder when the world is empty', () => {
    const w = new World(4, 4);
    const r = new Records();
    r.update(w, 0);
    expect(r.view().reigningElder.alive).toBe(false);
    expect(r.view().oldest.id).toBe(-1);
  });

  it('is deterministic for an identical life/death sequence', () => {
    const run = (): string => {
      const w = new World(8, 8);
      const r = new Records();
      const slots = spawn(w, 4);
      for (let tick = 0; tick < 20; tick++) {
        for (const s of slots) if (w.alive[s] === 1) w.age[s]++;
        if (tick === 5) w.killAgent(slots[1]);
        if (tick === 12) w.killAgent(slots[3]);
        r.update(w, tick);
      }
      return JSON.stringify(r.view());
    };
    expect(run()).toBe(run());
  });
});
