import type { World } from './world.ts';
import { TRAIT_COUNT, SIZE } from './genome.ts';

/** A record holder: a stable id, the record value, and a copy of its genome (for the binomial). */
export interface RecordHolder {
  id: number;
  value: number;
  traits: number[];
}

export interface PeakPopulation {
  value: number;
  tick: number;
}

/** The current oldest living creature (the reigning Elder, 034). */
export interface ReigningElder {
  id: number;
  age: number;
  traits: number[];
  alive: boolean;
}

/** A serialisable snapshot of the run's records, for the hall-of-fame panel. */
export interface RecordsView {
  oldest: RecordHolder;
  biggest: RecordHolder;
  mostOffspring: RecordHolder;
  /** Deepest unbroken lineage (max generation) — the most enduring bloodline/species. */
  longestBloodline: RecordHolder;
  peakPopulation: PeakPopulation;
  reigningElder: ReigningElder;
}

function newHolder(): RecordHolder {
  return { id: -1, value: -1, traits: new Array<number>(TRAIT_COUNT).fill(0) };
}

/**
 * Running records over a run (specification: relatability — stakes and stories).
 * Updated each tick from the live population; all-time records only ever rise, so
 * they survive their holders' deaths. Deterministic (slot-order, ties to the
 * earliest slot) and allocation-light: the records and the returned view reuse
 * preallocated objects and trait arrays.
 */
export class Records {
  private readonly v: RecordsView = {
    oldest: newHolder(),
    biggest: newHolder(),
    mostOffspring: newHolder(),
    longestBloodline: newHolder(),
    peakPopulation: { value: 0, tick: 0 },
    reigningElder: { id: -1, age: 0, traits: new Array<number>(TRAIT_COUNT).fill(0), alive: false },
  };

  /** Fold the current population into the records (call once per tick). */
  update(world: World, tick: number): void {
    const v = this.v;
    const { alive, age, id, generation, offspringCount, traits, agentCapacity } = world;
    const sizeCol = traits[SIZE];

    let elderId = -1;
    let elderAge = -1;
    let elderSlot = -1;
    for (let s = 0; s < agentCapacity; s++) {
      if (alive[s] === 0) continue;
      const a = age[s];
      if (a > elderAge) {
        elderAge = a;
        elderId = id[s];
        elderSlot = s;
      }
      if (a > v.oldest.value) setHolder(v.oldest, world, s, a);
      const sz = sizeCol[s];
      if (sz > v.biggest.value) setHolder(v.biggest, world, s, sz);
      const off = offspringCount[s];
      if (off > v.mostOffspring.value) setHolder(v.mostOffspring, world, s, off);
      const gen = generation[s];
      if (gen > v.longestBloodline.value) setHolder(v.longestBloodline, world, s, gen);
    }

    if (world.population > v.peakPopulation.value) {
      v.peakPopulation.value = world.population;
      v.peakPopulation.tick = tick;
    }

    v.reigningElder.id = elderId;
    v.reigningElder.age = elderAge < 0 ? 0 : elderAge;
    v.reigningElder.alive = elderId !== -1;
    if (elderSlot !== -1) copyTraits(v.reigningElder.traits, world, elderSlot);
  }

  /** The current records (a reused object; clone on post crosses the worker boundary). */
  view(): RecordsView {
    return this.v;
  }
}

function setHolder(h: RecordHolder, world: World, s: number, value: number): void {
  h.id = world.id[s];
  h.value = value;
  copyTraits(h.traits, world, s);
}

function copyTraits(dst: number[], world: World, s: number): void {
  for (let t = 0; t < TRAIT_COUNT; t++) dst[t] = world.traits[t][s];
}
