import type { World } from './world.ts';
import type { CatastropheKind } from './events.ts';

/** The notable-moment kinds the log records (specification: Domain rules → Events). */
export type SimEventKind =
  | 'freak'
  | 'catastrophe'
  | 'species'
  | 'massDeath'
  | 'nearExtinction'
  | 'obituary';

/**
 * One notable moment. A single flat shape (rather than a discriminated union of
 * payloads) so the log can pool and reuse records without per-event allocation;
 * unused fields stay zero. Cloned out by {@link EventLog.drain} for posting.
 */
export interface SimEvent {
  kind: SimEventKind;
  tick: number;
  /** Creature stable id (freak, obituary), else 0. */
  id: number;
  x: number;
  y: number;
  /** Deaths (catastrophe, massDeath). */
  deaths: number;
  /** Species count (species). */
  count: number;
  /** Catastrophe kind (catastrophe), else ''. */
  catastrophe: CatastropheKind | '';
  /** Age in ticks at death (obituary). */
  age: number;
  /** Offspring at death (obituary). */
  offspring: number;
}

interface Watch {
  id: number;
  slot: number;
  age: number;
  offspring: number;
}

function blankEvent(): SimEvent {
  return { kind: 'freak', tick: 0, id: 0, x: 0, y: 0, deaths: 0, count: 0, catastrophe: '', age: 0, offspring: 0 };
}

/**
 * A bounded, reused log of notable moments. The `Simulation` sets the current
 * tick, appends events as they happen, and {@link reconcile}s watched notable
 * creatures (freaks) into obituaries when they die. The worker {@link drain}s it
 * each frame and posts the events to the UI, so the picture, feed, and narrator
 * agree. Deterministic: it only ever reflects the deterministic simulation.
 */
export class EventLog {
  private readonly cap: number;
  private readonly ring: SimEvent[];
  private start = 0;
  private len = 0;
  private tick = 0;
  private readonly watch: Watch[] = [];

  constructor(capacity = 128) {
    this.cap = capacity;
    this.ring = Array.from({ length: capacity }, blankEvent);
  }

  /** Set the tick stamped on subsequent events (called once per tick). */
  setTick(tick: number): void {
    this.tick = tick;
  }

  /** A freak mutant was born; watch it so its passing earns an obituary. */
  freak(id: number, slot: number, x: number, y: number): void {
    const e = this.push();
    e.kind = 'freak';
    e.id = id;
    e.x = x;
    e.y = y;
    this.watch.push({ id, slot, age: 0, offspring: 0 });
  }

  catastrophe(kind: CatastropheKind, deaths: number): void {
    const e = this.push();
    e.kind = 'catastrophe';
    e.catastrophe = kind;
    e.deaths = deaths;
  }

  species(count: number): void {
    const e = this.push();
    e.kind = 'species';
    e.count = count;
  }

  massDeath(deaths: number): void {
    const e = this.push();
    e.kind = 'massDeath';
    e.deaths = deaths;
  }

  nearExtinction(): void {
    const e = this.push();
    e.kind = 'nearExtinction';
  }

  /**
   * Update each watched creature's last-known stats while it lives, and emit an
   * obituary the tick it dies (its slot is freed or reused). Called every tick,
   * so the captured age/offspring are at most one tick stale.
   */
  reconcile(world: World): void {
    for (let i = this.watch.length - 1; i >= 0; i--) {
      const w = this.watch[i];
      if (world.alive[w.slot] === 1 && world.id[w.slot] === w.id) {
        w.age = world.age[w.slot];
        w.offspring = world.offspringCount[w.slot];
      } else {
        const e = this.push();
        e.kind = 'obituary';
        e.id = w.id;
        e.age = w.age;
        e.offspring = w.offspring;
        this.watch.splice(i, 1);
      }
    }
  }

  /** Copy out and clear the pending events (for posting). Empty in the steady state. */
  drain(): SimEvent[] {
    if (this.len === 0) return [];
    const out: SimEvent[] = new Array(this.len);
    for (let i = 0; i < this.len; i++) out[i] = { ...this.ring[(this.start + i) % this.cap] };
    this.start = 0;
    this.len = 0;
    return out;
  }

  /** The next ring slot to write, blanked; drops the oldest pending event when full. */
  private push(): SimEvent {
    let slot: number;
    if (this.len < this.cap) {
      slot = (this.start + this.len) % this.cap;
      this.len++;
    } else {
      slot = this.start;
      this.start = (this.start + 1) % this.cap;
    }
    const e = this.ring[slot];
    e.tick = this.tick;
    e.id = 0;
    e.x = 0;
    e.y = 0;
    e.deaths = 0;
    e.count = 0;
    e.catastrophe = '';
    e.age = 0;
    e.offspring = 0;
    return e;
  }
}
