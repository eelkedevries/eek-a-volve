import { describe, it, expect } from 'vitest';
import { EventLog } from './eventlog.ts';
import { World } from './world.ts';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS } from './params.ts';

describe('EventLog', () => {
  it('records each kind of event for known inputs', () => {
    const log = new EventLog();
    log.setTick(5);
    log.freak(42, 0, 10, 20);
    log.catastrophe('meteor', 13);
    log.species(4);
    log.massDeath(30);
    log.nearExtinction();

    const out = log.drain();
    expect(out.map((e) => e.kind)).toEqual([
      'freak',
      'catastrophe',
      'species',
      'massDeath',
      'nearExtinction',
    ]);
    expect(out[0]).toMatchObject({ kind: 'freak', id: 42, x: 10, y: 20, tick: 5 });
    expect(out[1]).toMatchObject({ kind: 'catastrophe', catastrophe: 'meteor', deaths: 13 });
    expect(out[2]).toMatchObject({ kind: 'species', count: 4 });
    expect(out[3]).toMatchObject({ kind: 'massDeath', deaths: 30 });
  });

  it('drains to empty and is reusable', () => {
    const log = new EventLog();
    log.species(2);
    expect(log.drain()).toHaveLength(1);
    expect(log.drain()).toHaveLength(0);
  });

  it('emits an obituary when a watched freak dies, with its last stats', () => {
    const log = new EventLog();
    const w = new World(4, 4);
    const slot = w.spawnAgent();
    w.id[slot] = 99;
    w.age[slot] = 7;
    w.offspringCount[slot] = 3;

    log.setTick(1);
    log.freak(99, slot, 0, 0);
    log.drain(); // discard the freak event itself

    log.setTick(2);
    log.reconcile(w); // still alive — caches stats, emits nothing
    expect(log.drain()).toHaveLength(0);

    w.killAgent(slot);
    log.setTick(3);
    log.reconcile(w);
    const out = log.drain();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'obituary', id: 99, age: 7, offspring: 3 });
  });

  it('is bounded: keeps only the most recent capacity events', () => {
    const log = new EventLog(4);
    for (let i = 0; i < 10; i++) {
      log.setTick(i);
      log.species(i);
    }
    const out = log.drain();
    expect(out).toHaveLength(4);
    expect(out.map((e) => e.count)).toEqual([6, 7, 8, 9]); // oldest four dropped
  });
});

describe('event log in the simulation', () => {
  it('records catastrophe and new-species events over a run', () => {
    const sim = createSimulation({ ...DEFAULT_PARAMETERS, catastrophes: true, seed: 2 });
    const kinds = new Set<string>();
    for (let t = 0; t < 2500; t++) {
      sim.step();
      for (const e of sim.eventLog.drain()) kinds.add(e.kind);
    }
    expect(kinds.has('catastrophe')).toBe(true);
    expect(kinds.has('species')).toBe(true);
  }, 30000);

  it('captures freak births through the reproduction path', () => {
    const sim = createSimulation({ ...DEFAULT_PARAMETERS, seed: 3 });
    let freaks = 0;
    for (let t = 0; t < 6000; t++) {
      sim.step();
      for (const e of sim.eventLog.drain()) if (e.kind === 'freak') freaks++;
    }
    expect(freaks).toBeGreaterThan(0);
  }, 30000);

  it('produces an identical event stream for identical inputs', () => {
    const run = (): string[] => {
      const sim = createSimulation({ ...DEFAULT_PARAMETERS, catastrophes: true, seed: 3 });
      const events: string[] = [];
      for (let t = 0; t < 3000; t++) {
        sim.step();
        for (const e of sim.eventLog.drain()) {
          events.push(`${e.kind}:${e.tick}:${e.id}:${e.deaths}:${e.count}:${e.age}`);
        }
      }
      return events;
    };
    expect(run()).toEqual(run());
  }, 30000);
});
