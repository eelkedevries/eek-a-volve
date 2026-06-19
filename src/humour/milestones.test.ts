import { describe, it, expect } from 'vitest';
import { Milestones } from './milestones.ts';

describe('Milestones', () => {
  it('announces population marks once, in order', () => {
    const m = new Milestones();
    expect(m.update({ tick: 1, population: 20, speciesCount: 1 })).toBe(null);
    expect(m.update({ tick: 2, population: 60, speciesCount: 1 })).toContain('50');
    expect(m.update({ tick: 3, population: 70, speciesCount: 1 })).toBe(null); // 50 already done
    expect(m.update({ tick: 4, population: 120, speciesCount: 1 })).toContain('100');
  });

  it('announces extinction once after a living population', () => {
    const m = new Milestones();
    m.update({ tick: 1, population: 30, speciesCount: 1 });
    expect(m.update({ tick: 2, population: 0, speciesCount: 0 })).toContain('gone');
    expect(m.update({ tick: 3, population: 0, speciesCount: 0 })).toBe(null);
  });

  it('reports a catastrophe using only the supplied death count', () => {
    const m = new Milestones();
    const line = m.update({ tick: 9, population: 100, speciesCount: 2, event: { kind: 'plague', deaths: 17 } });
    expect(line).toContain('17');
    expect(line).toContain('plague');
  });

  it('notes a new lineage when the species count rises', () => {
    const m = new Milestones();
    // Population below the first mark, so only the species change is notable.
    m.update({ tick: 1, population: 30, speciesCount: 2 });
    expect(m.update({ tick: 2, population: 30, speciesCount: 3 })).toContain('lineage');
  });
});
