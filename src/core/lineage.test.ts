import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, SPEED, SENSE_RADIUS, DIET } from './genome.ts';
import { Behaviour } from './behaviour.ts';
import { inspectCreature } from './inspect.ts';
import { LineageRegistry, resolveAncestry, resolveFamily } from './lineage.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 200, worldHeight: 200, ...over };
}

describe('LineageRegistry', () => {
  it('records and reads back parentage', () => {
    const reg = new LineageRegistry(64);
    reg.record(3, 2);
    expect(reg.parentOf(3)).toBe(2);
    expect(reg.parentOf(2)).toBe(0); // never recorded
    expect(reg.parentOf(0)).toBe(0); // the "none" id
  });

  it('is bounded: capacity is fixed and old links are evicted', () => {
    const reg = new LineageRegistry(4);
    for (let id = 1; id <= 100; id++) reg.record(id, id - 1);
    expect(reg.capacity).toBe(4); // never grows
    expect(reg.parentOf(100)).toBe(99); // recent link survives
    expect(reg.parentOf(1)).toBe(0); // ancient link evicted
  });
});

describe('resolveAncestry', () => {
  it('walks parent then grandparent, using the registry once an ancestor has died', () => {
    const w = new World(8, 1);
    const reg = new LineageRegistry(64);
    // Living child with id 3, whose parent id is 2 (the parent is dead).
    const c = w.spawnAgent();
    w.id[c] = 3;
    w.parentId[c] = 2;
    reg.record(3, 2); // child → parent
    reg.record(2, 1); // parent → grandparent
    // grandparent (1) has no recorded parent, so the chain stops there.
    expect(resolveAncestry(w, reg, 3)).toEqual([2, 1]);
  });

  it('returns an empty chain for a founder', () => {
    const w = new World(4, 1);
    const reg = new LineageRegistry(64);
    const f = w.spawnAgent();
    w.id[f] = 5;
    w.parentId[f] = 0; // founder
    expect(resolveAncestry(w, reg, 5)).toEqual([]);
  });

  it('respects the depth limit', () => {
    const w = new World(2, 1);
    const reg = new LineageRegistry(64);
    // A long chain entirely in the registry: 10 → 9 → … → 1.
    for (let id = 2; id <= 10; id++) reg.record(id, id - 1);
    expect(resolveAncestry(w, reg, 10, 3)).toEqual([9, 8, 7]);
  });
});

describe('lineage in behaviour and the loop', () => {
  it('a birth records the parent id on the child and exposes the newborn slot', () => {
    const p = params({ reproductionThreshold: 50, mutationRate: 0, sexualReproduction: false });
    const w = new World(8, 1);
    const a = w.spawnAgent();
    w.x[a] = 50;
    w.y[a] = 50;
    w.energy[a] = 100;
    w.age[a] = 300; // mature
    w.traits[SIZE][a] = 1;
    w.traits[SPEED][a] = 0;
    w.traits[SENSE_RADIUS][a] = 10;
    w.traits[DIET][a] = 0;
    const agents = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.agentCapacity);
    agents.rebuildFromAgents(w);
    const food = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.foodCapacity);
    const behaviour = new Behaviour(w.agentCapacity);
    const births = behaviour.step(w, p, food, agents, new Rng(1));
    expect(births).toBe(1);
    let child = -1;
    for (let s = 0; s < w.agentCapacity; s++) if (w.alive[s] && s !== a) child = s;
    expect(child).not.toBe(-1);
    expect(w.parentId[child]).toBe(w.id[a]);
    expect(behaviour.newbornCount).toBe(1);
    expect(behaviour.newborns[0]).toBe(child);
  });

  it('the simulation records lineage so inspecting a descendant shows ancestry', () => {
    const sim = createSimulation(
      params({ worldWidth: 300, worldHeight: 300, initialPopulation: 80, foodAbundance: 300, seed: 3 }),
    );
    sim.run(800);
    const w = sim.world;
    let descendant = -1;
    for (let s = 0; s < w.agentCapacity; s++) {
      if (w.alive[s] === 1 && w.parentId[s] !== 0) {
        descendant = s;
        break;
      }
    }
    expect(descendant).not.toBe(-1); // births happened during the run
    const detail = inspectCreature(sim, w.id[descendant]);
    expect(detail.alive).toBe(true);
    expect(detail.ancestry.length).toBeGreaterThanOrEqual(1);
    expect(detail.ancestry[0]).toBe(w.parentId[descendant]);
  });

  it('resolveFamily returns ancestors and living descendants', () => {
    const sim = createSimulation(params({ initialPopulation: 3, foodAbundance: 20 }));
    const w = sim.world;
    // Overwrite the three founders into a known chain: 100 → 101 → 102.
    const slots: number[] = [];
    for (let s = 0; s < w.agentCapacity && slots.length < 3; s++) if (w.alive[s] === 1) slots.push(s);
    const [a, b, c] = slots; // grandparent, parent, child
    w.id[a] = 100; w.parentId[a] = 0;
    w.id[b] = 101; w.parentId[b] = 100;
    w.id[c] = 102; w.parentId[c] = 101;
    sim.lineage.record(101, 100);
    sim.lineage.record(102, 101);

    const grandparent = resolveFamily(sim, 100);
    expect(grandparent.ancestry).toEqual([]); // a founder
    expect(grandparent.descendants.sort()).toEqual([101, 102]);

    const parent = resolveFamily(sim, 101);
    expect(parent.ancestry).toEqual([100]);
    expect(parent.descendants).toEqual([102]);
  });
});
