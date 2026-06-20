import type { SimEvent } from '../core/eventlog.ts';
import type { Renderer } from './renderer.ts';
import { HEADER_LENGTH, AGENT_STRIDE, A_X, A_Y, A_ID, A_STATE, unpackStage, unpackAction } from '../core/snapshot.ts';
import { ELDER } from '../core/lifestage.ts';
import { EATING, HUNTING, FLEEING, COURTING } from '../core/state.ts';

/** How long a chosen subject is held before the director reconsiders. */
const HOLD_MS = 5200;
/** How long freak / catastrophe interest lingers. */
const FREAK_TTL = 12000;
const CATASTROPHE_TTL = 5000;
/** Base scores per candidate kind (decayed by freshness where noted). */
const FREAK_SCORE = 100;
const CATASTROPHE_SCORE = 130;
const ELDER_SCORE = 36;
const HOTSPOT_BASE = 18;
const HOTSPOT_PER_AGENT = 5;
/** World span (units) each shot frames. */
const FREAK_SPAN = 120;
const ELDER_SPAN = 150;
const HOTSPOT_SPAN = 220;
/** Coarse density grid for finding action hotspots. */
const GRID = 6;
const HOTSPOT_MIN = 2;

interface Subject {
  /** 'creature' subjects pin a nameplate by id; 'wide' pulls back over the whole world. */
  kind: 'creature' | 'wide';
  id: number;
  span: number;
}

interface FreakRef {
  id: number;
  t: number;
}

/**
 * The auto-director (specification: relatability — a long run worth watching). A
 * main-thread policy that scores candidate subjects from the event stream (036)
 * and the live snapshot, eases the camera to the best one via the {@link Renderer}
 * (032), and holds briefly before reconsidering. It yields immediately to manual
 * camera control or an adopted creature, and can be toggled off.
 */
export class Director {
  enabled = true;

  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly freaks: FreakRef[] = [];
  private catastropheT = -Infinity;

  private subject: Subject | null = null;
  private holdUntil = 0;

  constructor(worldWidth: number, worldHeight: number) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  /** Note recent events (freaks and catastrophes raise interest). */
  ingest(events: SimEvent[], now: number): void {
    for (const e of events) {
      if (e.kind === 'freak') this.freaks.push({ id: e.id, t: now });
      else if (e.kind === 'catastrophe') this.catastropheT = now;
    }
    // Forget stale freaks so the list stays bounded.
    while (this.freaks.length > 0 && now - this.freaks[0].t > FREAK_TTL) this.freaks.shift();
  }

  /** Each frame: choose/hold a subject and command the camera + nameplate. */
  update(view: Float32Array, count: number, now: number, renderer: Renderer): void {
    if (!this.enabled || renderer.isFollowing() || renderer.isManualActive()) {
      renderer.clearDirectorTarget();
      renderer.clearNameplate();
      return;
    }

    // Reconsider when the hold lapses or the current subject is no longer valid.
    if (this.subject === null || now >= this.holdUntil || !this.valid(view, count, this.subject)) {
      this.subject = this.pick(view, count, now);
      this.holdUntil = now + HOLD_MS;
    }

    const s = this.subject;
    if (s.kind === 'wide') {
      renderer.directorEaseTo(this.worldWidth / 2, this.worldHeight / 2, this.worldWidth);
      renderer.clearNameplate();
      return;
    }
    const idx = this.find(view, count, s.id);
    if (idx === -1) {
      renderer.clearDirectorTarget();
      renderer.clearNameplate();
      return;
    }
    const o = HEADER_LENGTH + idx * AGENT_STRIDE;
    renderer.directorEaseTo(view[o + A_X], view[o + A_Y], s.span);
    renderer.setNameplate(s.id);
  }

  /** Pick the highest-scoring subject from current events and state. */
  private pick(view: Float32Array, count: number, now: number): Subject {
    let bestScore = -1;
    let best: Subject = { kind: 'wide', id: -1, span: this.worldWidth };

    const consider = (score: number, subject: Subject): void => {
      if (score > bestScore) {
        bestScore = score;
        best = subject;
      }
    };

    if (now - this.catastropheT < CATASTROPHE_TTL) {
      consider(CATASTROPHE_SCORE * (1 - (now - this.catastropheT) / CATASTROPHE_TTL), {
        kind: 'wide',
        id: -1,
        span: this.worldWidth,
      });
    }

    for (const fr of this.freaks) {
      const age = now - fr.t;
      if (age >= FREAK_TTL || this.find(view, count, fr.id) === -1) continue;
      consider(FREAK_SCORE * (1 - age / FREAK_TTL), { kind: 'creature', id: fr.id, span: FREAK_SPAN });
    }

    const scan = this.scan(view, count);
    if (scan.elderId !== -1) {
      consider(ELDER_SCORE, { kind: 'creature', id: scan.elderId, span: ELDER_SPAN });
    }
    if (scan.hotId !== -1 && scan.hotCount >= HOTSPOT_MIN) {
      consider(HOTSPOT_BASE + scan.hotCount * HOTSPOT_PER_AGENT, {
        kind: 'creature',
        id: scan.hotId,
        span: HOTSPOT_SPAN,
      });
    }

    return best;
  }

  /** One snapshot pass: find an elder and the densest cluster of "active" creatures. */
  private scan(view: Float32Array, count: number): { elderId: number; hotId: number; hotCount: number } {
    const counts = new Int32Array(GRID * GRID);
    const repId = new Int32Array(GRID * GRID).fill(-1);
    const cw = this.worldWidth / GRID;
    const ch = this.worldHeight / GRID;
    let elderId = -1;

    for (let i = 0; i < count; i++) {
      const o = HEADER_LENGTH + i * AGENT_STRIDE;
      const state = view[o + A_STATE];
      if (elderId === -1 && unpackStage(state) === ELDER) elderId = view[o + A_ID];
      const action = unpackAction(state);
      if (action === EATING || action === HUNTING || action === FLEEING || action === COURTING) {
        let gx = Math.floor(view[o + A_X] / cw);
        let gy = Math.floor(view[o + A_Y] / ch);
        gx = gx < 0 ? 0 : gx >= GRID ? GRID - 1 : gx;
        gy = gy < 0 ? 0 : gy >= GRID ? GRID - 1 : gy;
        const cell = gy * GRID + gx;
        counts[cell]++;
        if (repId[cell] === -1) repId[cell] = view[o + A_ID];
      }
    }

    let hotCell = -1;
    let hotCount = 0;
    for (let c = 0; c < counts.length; c++) {
      if (counts[c] > hotCount) {
        hotCount = counts[c];
        hotCell = c;
      }
    }
    return { elderId, hotId: hotCell === -1 ? -1 : repId[hotCell], hotCount };
  }

  private valid(view: Float32Array, count: number, subject: Subject): boolean {
    return subject.kind === 'wide' || this.find(view, count, subject.id) !== -1;
  }

  private find(view: Float32Array, count: number, id: number): number {
    for (let i = 0; i < count; i++) {
      if (view[HEADER_LENGTH + i * AGENT_STRIDE + A_ID] === id) return i;
    }
    return -1;
  }
}
