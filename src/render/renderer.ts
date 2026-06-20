import {
  Application,
  Container,
  ParticleContainer,
  Particle,
  Graphics,
  Text,
  type Texture,
} from 'pixi.js';
import { personalName } from '../humour/names.ts';
import {
  HEADER_LENGTH,
  AGENT_STRIDE,
  A_X,
  A_Y,
  A_COLOUR,
  A_SCALE,
  A_HEADING,
  A_STATE,
  A_DIET,
  A_SENSE,
  A_ID,
  A_ENERGY,
  unpackStage,
  unpackAction,
  foodOffset,
  FOOD_STRIDE,
  FOOD_X,
  FOOD_Y,
  FOOD_TYPE,
  H_FOOD_COUNT,
  H_DEATHS,
  H_POPULATION,
} from '../core/snapshot.ts';
import { CreatureSprite } from './creatureSprite.ts';
import { Camera, type Bounds } from './camera.ts';
import { Effects } from './effects.ts';
import { Emotes, EMOTE_NONE, EMOTE_SCARED, EMOTE_AMOROUS, EMOTE_HUNGRY } from './emotes.ts';
import { EATING, HUNTING, FLEEING, COURTING } from '../core/state.ts';
import { ELDER } from '../core/lifestage.ts';
import type { SimulationParameters } from '../core/params.ts';

/** Selectable species palettes. The "safe" set is Okabe–Ito, designed to stay
 *  distinct under the common colour-vision deficiencies; role/state never relies
 *  on colour alone (maw, eyes, crown, emotes, and labels back it up). */
export const PALETTES: { name: string; colours: number[] }[] = [
  { name: 'Vivid', colours: [0xff5d5d, 0x5dff7a, 0x5d9bff, 0xffd14d, 0xc77dff, 0x46d8c4, 0xff8fc4, 0x9aa7b4] },
  {
    name: 'Colour-blind safe',
    colours: [0xe69f00, 0x56b4e9, 0x009e73, 0xf0e442, 0x0072b2, 0xd55e00, 0xcc79a7, 0xbbbbbb],
  },
];

/** The default (Vivid) palette, exported for the legend. */
export const SPECIES_COLOURS = PALETTES[0].colours;

/** Module-level active palette (one renderer instance), switched at runtime. */
let activePalette = PALETTES[0].colours;

function setActivePalette(index: number): void {
  activePalette = (PALETTES[index] ?? PALETTES[0]).colours;
}

function colourFor(index: number): number {
  if (index < 0) return 0xdddddd;
  return activePalette[index % activePalette.length];
}

/** Food tints by type: green plants, muted brown carrion. */
const PLANT_COLOUR = 0x6abf52;
const CARRION_COLOUR = 0x9c6b3f;

/** The emote to show for an action/energy, by priority: scared, then amorous, then hungry. */
function emoteKind(action: number, energy: number): number {
  if (action === FLEEING) return EMOTE_SCARED;
  if (action === COURTING) return EMOTE_AMOROUS;
  if (energy < HUNGRY_FRACTION) return EMOTE_HUNGRY;
  return EMOTE_NONE;
}

/** In swarm mode, zoom at or beyond this switches the on-screen subset to detailed creatures. */
const SWARM_DETAIL_ZOOM = 1.5;
/** Camera zoom at or beyond which emotes and crowns are shown (else they would clutter). */
const EMOTE_MIN_ZOOM = 1.2;
/** Energy fraction below which a creature shows the hungry emote. */
const HUNGRY_FRACTION = 0.3;
/** Detailed-creature budgets per quality level; overflow falls back to the haze. */
const DETAIL_BUDGET = { low: 150, medium: 500, high: 900 } as const;
export type QualityLevel = keyof typeof DETAIL_BUDGET;
/** World-unit margin around the viewport kept when culling, so edge creatures still draw. */
const CULL_MARGIN = 24;
/** Screen-pixel radius within which a click selects a creature; converted to world units. */
const PICK_RADIUS_PX = 16;
/** Pointer travel (px) beyond which a press counts as a pan, not a click. */
const CLICK_SLOP = 5;
/** Squared world distance within which the nearest agent to a newborn is taken as its parent. */
const BIRTH_LINK_R2 = 6 * 6;
/** Cap on the real-time step fed to effects, so a long stall does not jump them. */
const MAX_EFFECT_DT = 0.1;
/** Duration (ms) of the eating/birth squash-and-stretch pop. */
const SQUASH_MS = 220;
/** Duration (ms) of the hunt-kill colour flash. */
const FLASH_MS = 180;
/** World units moved between frames above which a creature leaves a motion trail. */
const TRAIL_MIN_DISP = 1.1;
/** Screen-shake amplitude cap (px) and per-frame decay; catastrophe-scale deaths only. */
const SHAKE_CAP = 12;
const SHAKE_DECAY = 0.86;
/** A death count this far above the population's routine churn counts as a catastrophe. */
const SHAKE_DEATH_FLOOR = 10;
const SHAKE_DEATH_FRACTION = 0.04;
/** After a manual pan/zoom/select, leave the camera under manual control this long. */
const MANUAL_SUSPEND_MS = 6000;
/** Director easing rate (per second); higher eases faster. */
const DIRECTOR_EASE_RATE = 2.6;
/** Camera scale clamp (matches the camera's own limits). */
const MIN_CAMERA_SCALE = 0.05;
const MAX_CAMERA_SCALE = 40;

/** Per-agent bookkeeping for spotting births, deaths, action transitions, and juice pulses. */
interface AgentTrace {
  action: number;
  x: number;
  y: number;
  seen: number;
  /** performance.now() until which an eating/birth squash plays. */
  squashUntil: number;
  /** performance.now() until which a hunt-kill flash plays. */
  flashUntil: number;
}

/**
 * PixiJS v8 renderer (specification: Architecture → `render/`). Everything lives
 * in a world container under a {@link Camera} (pan/zoom/fit/follow). Two draw
 * strategies share the container: a detailed `Container` of {@link CreatureSprite}s
 * and a batched `ParticleContainer` haze. The view mode (030) and the camera zoom
 * pick the level of detail — community is always detailed; swarm hazes when zoomed
 * out and details the culled, capped on-screen subset when zoomed in. Click selects
 * the creature under the cursor (by stable id) for follow and, later, the inspector.
 */
export class Renderer {
  private app!: Application;
  private world!: Container;
  private agents!: ParticleContainer;
  private creatureLayer!: Container;
  private foodLayer!: ParticleContainer;
  private texture!: Texture;
  private foodTexture!: Texture;
  private readonly particles: Particle[] = [];
  private readonly creatures: CreatureSprite[] = [];
  private readonly foodParticles: Particle[] = [];
  private readonly camera = new Camera();
  private effects!: Effects;
  private emotes!: Emotes;
  private mode: SimulationParameters['viewMode'] = 'community';
  private worldWidth = 1;
  private worldHeight = 1;

  // Behaviour-cue bookkeeping: previous-frame trace per stable id, and a frame counter.
  private readonly trace = new Map<number, AgentTrace>();
  private frameNo = 0;
  private lastDraw = 0;
  private now = 0;

  // Visual juice, all honouring reduced motion.
  private reducedMotion = false;
  private shakeAmp = 0;

  // Quality/scale: cap detailed creatures and toggle effects; overflow → haze.
  private detailBudget: number = DETAIL_BUDGET.medium;
  private effectsEnabled = true;

  // Latest snapshot, kept so pointer events can pick and follow between frames.
  private lastView: Float32Array | null = null;
  private lastCount = 0;
  private selectedId = -1;
  private following = false;
  /** performance.now() until which the camera stays under manual control. */
  private manualUntil = 0;

  // Auto-director target (eased to when not manual/adopting) and pinned nameplate.
  private directorActive = false;
  private directorX = 0;
  private directorY = 0;
  private directorSpan = 1;
  private nameplate!: Text;
  private nameplateId = -1;

  // Pointer/gesture state for pan, pinch, and click-to-select.
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private panPointer = -1;
  private panLastX = 0;
  private panLastY = 0;
  private pressX = 0;
  private pressY = 0;
  private pressMoved = false;
  private pinchDist = 0;
  private suppressClick = false;

  async init(
    mount: HTMLElement,
    worldWidth: number,
    worldHeight: number,
    mode: SimulationParameters['viewMode'],
  ): Promise<void> {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.mode = mode;

    this.app = new Application();
    await this.app.init({ background: 0x101418, resizeTo: mount, antialias: true });
    mount.appendChild(this.app.canvas);

    const circle = new Graphics().circle(0, 0, 8).fill(0xffffff);
    this.texture = this.app.renderer.generateTexture(circle);
    circle.destroy();

    const dot = new Graphics().circle(0, 0, 4).fill(0xffffff);
    this.foodTexture = this.app.renderer.generateTexture(dot);
    dot.destroy();

    // World container under the camera; draw order: food, swarm haze, creatures.
    this.world = new Container();
    this.foodLayer = new ParticleContainer({
      dynamicProperties: { position: true, vertex: true, color: true },
    });
    this.agents = new ParticleContainer({
      dynamicProperties: { position: true, vertex: true, color: true },
    });
    this.creatureLayer = new Container();
    this.effects = new Effects(this.app.renderer);
    this.world.addChild(this.foodLayer, this.agents, this.creatureLayer, this.effects.view);
    this.app.stage.addChild(this.world);

    // Emotes/crowns live in screen space (above the world) so they stay readable.
    this.emotes = new Emotes(this.app.renderer);
    this.app.stage.addChild(this.emotes.view);

    // The director's nameplate: a single screen-space label over the spotlight.
    this.nameplate = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 15,
        fontWeight: '700',
        fill: 0xffffff,
        stroke: { color: 0x10151b, width: 4 },
      },
    });
    this.nameplate.anchor.set(0.5, 1);
    this.nameplate.visible = false;
    this.app.stage.addChild(this.nameplate);

    this.camera.fit(worldWidth, worldHeight, this.app.renderer.width, this.app.renderer.height);
    this.lastDraw = performance.now();

    // Accessibility: honour the OS reduced-motion preference (and track changes).
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mq !== undefined) {
      this.reducedMotion = mq.matches;
      mq.addEventListener?.('change', (e) => this.setReducedMotion(e.matches));
    }

    this.setupInteraction();
  }

  /** The stable id of the selected creature, or -1. */
  getSelectedId(): number {
    return this.selectedId;
  }

  /** Adopt (camera-follow) the selected creature, or stop following. */
  setFollowing(on: boolean): void {
    this.following = on;
  }

  /** Clear the current selection and stop following (e.g. when the creature dies). */
  clearSelection(): void {
    this.selectedId = -1;
    this.following = false;
  }

  /** True while the viewer is driving the camera (recent pan/zoom/select). */
  isManualActive(): boolean {
    return performance.now() < this.manualUntil;
  }

  /** True while a creature is adopted (camera following it). */
  isFollowing(): boolean {
    return this.following && this.selectedId !== -1;
  }

  /** Ask the director to ease the camera to a world point, framing `span` world units. */
  directorEaseTo(worldX: number, worldY: number, span: number): void {
    this.directorActive = true;
    this.directorX = worldX;
    this.directorY = worldY;
    this.directorSpan = span;
  }

  /** Stop director control of the camera (falls back to fit/manual). */
  clearDirectorTarget(): void {
    this.directorActive = false;
  }

  /** Pin a nameplate (by stable id) over the spotlighted creature, or -1 to clear. */
  setNameplate(id: number): void {
    if (id === this.nameplateId) return;
    this.nameplateId = id;
    if (id === -1) {
      this.nameplate.visible = false;
    } else {
      this.nameplate.text = personalName(id);
    }
  }

  clearNameplate(): void {
    this.setNameplate(-1);
  }

  /** Turn motion (shake, trails, flash, squash, cues, eased cuts) on or off. */
  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
    if (on) {
      this.shakeAmp = 0;
      this.app.stage.position.set(0, 0);
    }
  }

  /** Whether reduced motion is currently active (to seed a manual toggle). */
  isReducedMotion(): boolean {
    return this.reducedMotion;
  }

  /** Choose a species palette (0 = Vivid, 1 = colour-blind safe). */
  setPalette(index: number): void {
    setActivePalette(index);
  }

  /** Set the quality/scale level: caps detailed creatures and toggles effect cues. */
  setQuality(level: QualityLevel): void {
    this.detailBudget = DETAIL_BUDGET[level];
    this.effectsEnabled = level !== 'low';
  }

  /** Draw a snapshot: keep it for picking, move the camera, then food + the LOD strategy. */
  draw(view: Float32Array, count: number): void {
    this.lastView = view;
    this.lastCount = count;
    this.now = performance.now();
    const dt = Math.min((this.now - this.lastDraw) / 1000, MAX_EFFECT_DT);
    this.lastDraw = this.now;
    const vw = this.app.renderer.width;
    const vh = this.app.renderer.height;

    this.applyShake(view[H_DEATHS] | 0, view[H_POPULATION] | 0);

    // Camera arbitration, by priority: adopt → manual → director → fit-to-world.
    if (this.following && this.selectedId !== -1) {
      const idx = this.findById(this.selectedId);
      if (idx === -1) {
        this.following = false;
        this.selectedId = -1;
        this.camera.fit(this.worldWidth, this.worldHeight, vw, vh);
      } else {
        const o = HEADER_LENGTH + idx * AGENT_STRIDE;
        this.camera.centreOn(view[o + A_X], view[o + A_Y], vw, vh);
      }
    } else if (this.now < this.manualUntil) {
      // Leave the camera where the viewer put it.
    } else if (this.directorActive) {
      this.easeCameraToDirector(vw, vh, dt);
    } else {
      this.camera.fit(this.worldWidth, this.worldHeight, vw, vh);
    }

    this.camera.applyTo(this.world);
    this.drawFood(view, count);

    const b = this.camera.visibleBounds(vw, vh);
    const bounds: Bounds = {
      minX: b.minX - CULL_MARGIN,
      minY: b.minY - CULL_MARGIN,
      maxX: b.maxX + CULL_MARGIN,
      maxY: b.maxY + CULL_MARGIN,
    };
    const detailed = this.mode === 'community' || this.camera.scale >= SWARM_DETAIL_ZOOM;
    if (detailed) {
      this.creatureLayer.visible = true;
      const capped = this.drawDetailed(view, count, bounds, this.camera.scale >= EMOTE_MIN_ZOOM);
      // Graceful degradation: when over the detail budget, draw the rest as haze.
      this.agents.visible = capped;
      if (capped) this.drawSwarmHaze(view, count);
    } else {
      this.creatureLayer.visible = false;
      this.agents.visible = true;
      this.drawSwarmHaze(view, count);
      this.emotes.clear();
    }

    this.updateEffects(view, count, detailed, dt);
    this.updateNameplate(vw);
  }

  /** Ease the camera centre and zoom toward the director's current target. */
  private easeCameraToDirector(vw: number, vh: number, dt: number): void {
    // Under reduced motion, cut instantly (no smooth camera travel).
    const k = this.reducedMotion ? 1 : 1 - Math.exp(-dt * DIRECTOR_EASE_RATE);
    const cx = this.camera.screenToWorldX(vw / 2);
    const cy = this.camera.screenToWorldY(vh / 2);
    let target = Math.min(vw, vh) / this.directorSpan;
    target = target < MIN_CAMERA_SCALE ? MIN_CAMERA_SCALE : target > MAX_CAMERA_SCALE ? MAX_CAMERA_SCALE : target;
    this.camera.scale += (target - this.camera.scale) * k;
    this.camera.centreOn(cx + (this.directorX - cx) * k, cy + (this.directorY - cy) * k, vw, vh);
  }

  /** Position the director's nameplate over its creature, or hide it. */
  private updateNameplate(vw: number): void {
    if (this.nameplateId === -1) {
      this.nameplate.visible = false;
      return;
    }
    const idx = this.findById(this.nameplateId);
    if (idx === -1) {
      this.nameplate.visible = false;
      return;
    }
    const view = this.lastView!;
    const o = HEADER_LENGTH + idx * AGENT_STRIDE;
    const radius = view[o + A_SCALE] * 0.4 * 8 * this.camera.scale;
    const sx = this.camera.worldToScreenX(view[o + A_X]);
    const sy = this.camera.worldToScreenY(view[o + A_Y]);
    // Keep it on screen even when the subject drifts to an edge.
    this.nameplate.x = sx < 8 ? 8 : sx > vw - 8 ? vw - 8 : sx;
    this.nameplate.y = sy - radius - 30 < 14 ? 14 : sy - radius - 30;
    this.nameplate.visible = true;
  }

  /** Restrained, capped screen shake on catastrophe-scale death spikes; off under reduced motion. */
  private applyShake(deaths: number, population: number): void {
    if (!this.reducedMotion && deaths > SHAKE_DEATH_FLOOR && deaths > population * SHAKE_DEATH_FRACTION) {
      this.shakeAmp = SHAKE_CAP;
    }
    if (this.reducedMotion || this.shakeAmp < 0.2) {
      this.shakeAmp = 0;
      this.app.stage.position.set(0, 0);
      return;
    }
    this.app.stage.position.set(
      (Math.random() * 2 - 1) * this.shakeAmp,
      (Math.random() * 2 - 1) * this.shakeAmp,
    );
    this.shakeAmp *= SHAKE_DECAY;
  }

  /**
   * Spawn behaviour cues from snapshot state. New stable ids are births (with a
   * parent→newborn line); ids that vanish are deaths; an action that changes into
   * eating/hunting/fleeing/courting fires its cue once (only while creatures are
   * shown in detail, so a zoomed-out haze does not flood the pool).
   */
  private updateEffects(view: Float32Array, count: number, detailed: boolean, dt: number): void {
    // The trace is always maintained (so re-enabling does not burst), but spawning
    // cues is gated: off under reduced motion or low quality. Squash/flash pulses
    // are cheap and gated only by reduced motion.
    const cues = this.effectsEnabled && !this.reducedMotion;
    const juice = !this.reducedMotion;
    const f = ++this.frameNo;
    for (let i = 0; i < count; i++) {
      const o = HEADER_LENGTH + i * AGENT_STRIDE;
      const id = view[o + A_ID];
      const x = view[o + A_X];
      const y = view[o + A_Y];
      const action = unpackAction(view[o + A_STATE]);
      const e = this.trace.get(id);
      if (e === undefined) {
        // Birth: pop the newborn, sparkle, and link it to its parent.
        this.trace.set(id, { action, x, y, seen: f, squashUntil: juice ? this.now + SQUASH_MS : 0, flashUntil: 0 });
        if (cues) {
          this.effects.spawnBirth(x, y);
          if (this.effects.canLineage()) {
            const parent = this.findParent(view, count, i, x, y);
            if (parent !== -1) this.effects.spawnLineage(parent, id);
          }
        }
      } else {
        if (action !== e.action) {
          if (action === EATING) {
            if (juice) e.squashUntil = this.now + SQUASH_MS;
            if (cues && detailed) this.effects.spawnMunch(x, y);
          } else if (action === HUNTING) {
            if (juice) e.flashUntil = this.now + FLASH_MS;
            if (cues && detailed) this.effects.spawnHunt(x, y);
          } else if (action === FLEEING) {
            if (cues && detailed) this.effects.spawnFlee(x, y, view[o + A_HEADING]);
          } else if (action === COURTING) {
            if (cues && detailed) this.effects.spawnCourt(x, y);
          }
        }
        // Speed-driven motion trail (uses the previous position before overwriting it).
        if (cues && detailed) {
          const dx = x - e.x;
          const dy = y - e.y;
          if (dx * dx + dy * dy > TRAIL_MIN_DISP * TRAIL_MIN_DISP) {
            this.effects.spawnTrail(e.x, e.y, colourFor(view[o + A_COLOUR] | 0));
          }
        }
        e.action = action;
        e.x = x;
        e.y = y;
        e.seen = f;
      }
    }
    for (const [id, e] of this.trace) {
      if (e.seen !== f) {
        if (cues) this.effects.spawnDeath(e.x, e.y);
        this.trace.delete(id);
      }
    }
    this.effects.update(dt, this.trace);
  }

  /** The nearest agent to a newborn (which spawns at its parent's position), by stable id. */
  private findParent(view: Float32Array, count: number, childIndex: number, cx: number, cy: number): number {
    let best = -1;
    let bestD = BIRTH_LINK_R2;
    for (let j = 0; j < count; j++) {
      if (j === childIndex) continue;
      const o = HEADER_LENGTH + j * AGENT_STRIDE;
      const dx = view[o + A_X] - cx;
      const dy = view[o + A_Y] - cy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = view[o + A_ID];
      }
    }
    return best;
  }

  /**
   * Detailed creatures for the visible subset, up to the quality budget; returns
   * true if more visible creatures remained (so the caller draws the rest as haze).
   * Surplus pool objects are hidden.
   */
  private drawDetailed(view: Float32Array, count: number, bounds: Bounds, emotesOn: boolean): boolean {
    this.emotes.begin();
    let used = 0;
    let capped = false;
    for (let i = 0; i < count; i++) {
      const o = HEADER_LENGTH + i * AGENT_STRIDE;
      const wx = view[o + A_X];
      const wy = view[o + A_Y];
      if (wx < bounds.minX || wx > bounds.maxX || wy < bounds.minY || wy > bounds.maxY) continue;
      if (used >= this.detailBudget) {
        capped = true;
        break;
      }
      const size = view[o + A_SCALE];
      const state = view[o + A_STATE];
      const stage = unpackStage(state);
      const energy = view[o + A_ENERGY];

      // Juice pulses (squash on eat/birth, flash on a kill); skipped under reduced motion.
      let pop = 0;
      let flash = 0;
      if (!this.reducedMotion) {
        const tr = this.trace.get(view[o + A_ID]);
        if (tr !== undefined) {
          if (tr.squashUntil > this.now) pop = (tr.squashUntil - this.now) / SQUASH_MS;
          if (tr.flashUntil > this.now) flash = (tr.flashUntil - this.now) / FLASH_MS;
        }
      }

      this.creatureAt(used++).update(
        wx,
        wy,
        view[o + A_HEADING],
        size,
        view[o + A_DIET],
        view[o + A_SENSE],
        energy,
        stage,
        colourFor(view[o + A_COLOUR] | 0),
        1,
        pop,
        flash,
      );

      if (emotesOn) {
        const sx = this.camera.worldToScreenX(wx);
        const sy = this.camera.worldToScreenY(wy);
        const radius = size * 0.4 * 8 * this.camera.scale;
        if (stage === ELDER) this.emotes.showCrown(sx, sy - radius - 4);
        this.emotes.showEmote(sx, sy - radius - 18, emoteKind(unpackAction(state), energy));
      }
    }
    for (let i = used; i < this.creatures.length; i++) this.creatures[i].hide();
    this.emotes.end();
    return capped;
  }

  /** Swarm strategy: batched tinted dots, one per agent, drawn in world space. */
  private drawSwarmHaze(view: Float32Array, count: number): void {
    this.ensureParticles(count);
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (i < count) {
        const o = HEADER_LENGTH + i * AGENT_STRIDE;
        p.x = view[o + A_X];
        p.y = view[o + A_Y];
        const scale = view[o + A_SCALE] * 0.5;
        p.scaleX = scale;
        p.scaleY = scale;
        p.tint = colourFor(view[o + A_COLOUR] | 0);
      } else {
        p.scaleX = 0;
        p.scaleY = 0;
      }
    }
  }

  /** Food: tinted dots in world space, larger and browner for carrion than plants. */
  private drawFood(view: Float32Array, count: number): void {
    const foodCount = view[H_FOOD_COUNT] | 0;
    const base = foodOffset(count);
    this.ensureFood(foodCount);
    for (let i = 0; i < this.foodParticles.length; i++) {
      const p = this.foodParticles[i];
      if (i < foodCount) {
        const o = base + i * FOOD_STRIDE;
        p.x = view[o + FOOD_X];
        p.y = view[o + FOOD_Y];
        const carrion = view[o + FOOD_TYPE] >= 1;
        p.tint = carrion ? CARRION_COLOUR : PLANT_COLOUR;
        const s = carrion ? 0.9 : 0.5;
        p.scaleX = s;
        p.scaleY = s;
      } else {
        p.scaleX = 0;
        p.scaleY = 0;
      }
    }
  }

  /** Grow the detailed-creature pool to at least `index + 1` objects. */
  private creatureAt(index: number): CreatureSprite {
    while (this.creatures.length <= index) {
      const c = new CreatureSprite();
      this.creatures.push(c);
      this.creatureLayer.addChild(c.view);
    }
    return this.creatures[index];
  }

  private ensureParticles(count: number): void {
    while (this.particles.length < count) {
      const p = new Particle(this.texture);
      p.anchorX = 0.5;
      p.anchorY = 0.5;
      this.particles.push(p);
      this.agents.addParticle(p);
    }
  }

  private ensureFood(count: number): void {
    while (this.foodParticles.length < count) {
      const p = new Particle(this.foodTexture);
      p.anchorX = 0.5;
      p.anchorY = 0.5;
      this.foodParticles.push(p);
      this.foodLayer.addParticle(p);
    }
  }

  /** Dense index of the live agent with stable id `id`, or -1 if gone. */
  private findById(id: number): number {
    const view = this.lastView;
    if (view === null) return -1;
    for (let i = 0; i < this.lastCount; i++) {
      if (view[HEADER_LENGTH + i * AGENT_STRIDE + A_ID] === id) return i;
    }
    return -1;
  }

  // --- Interaction: drag to pan, wheel/pinch to zoom, click to select, double-click to fit. ---

  private setupInteraction(): void {
    const canvas = this.app.canvas;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('dblclick', this.onDoubleClick);
  }

  private localPoint(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    const p = this.localPoint(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.panPointer = e.pointerId;
      this.panLastX = p.x;
      this.panLastY = p.y;
      this.pressX = p.x;
      this.pressY = p.y;
      this.pressMoved = false;
      this.app.canvas.setPointerCapture(e.pointerId);
    } else if (this.pointers.size === 2) {
      this.pinchDist = this.pointerDistance();
      this.suppressClick = true;
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.localPoint(e);
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size >= 2) {
      const dist = this.pointerDistance();
      if (this.pinchDist > 0 && dist > 0) {
        const mid = this.pointerMidpoint();
        this.camera.zoomAt(mid.x, mid.y, dist / this.pinchDist);
        this.suspendCamera();
      }
      this.pinchDist = dist;
      return;
    }

    if (e.pointerId === this.panPointer) {
      this.camera.panBy(p.x - this.panLastX, p.y - this.panLastY);
      this.panLastX = p.x;
      this.panLastY = p.y;
      if (Math.abs(p.x - this.pressX) + Math.abs(p.y - this.pressY) > CLICK_SLOP) {
        this.pressMoved = true;
        this.suspendCamera();
      }
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    const wasClick = e.pointerId === this.panPointer && !this.pressMoved && !this.suppressClick;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
    if (this.pointers.size === 0) this.suppressClick = false;
    if (e.pointerId === this.panPointer) this.panPointer = -1;
    if (wasClick) this.selectAt(this.pressX, this.pressY);
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const p = this.localPoint(e);
    this.camera.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
    this.suspendCamera();
  };

  private readonly onDoubleClick = (): void => {
    this.following = false;
    this.camera.fit(this.worldWidth, this.worldHeight, this.app.renderer.width, this.app.renderer.height);
    this.suspendCamera(); // hold the overview briefly before the director resumes
  };

  /** Put the camera under manual control for a while (suspends the auto-director). */
  private suspendCamera(): void {
    this.manualUntil = performance.now() + MANUAL_SUSPEND_MS;
  }

  private pointerDistance(): number {
    const it = this.pointers.values();
    const a = it.next().value;
    const b = it.next().value;
    if (a === undefined || b === undefined) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private pointerMidpoint(): { x: number; y: number } {
    const it = this.pointers.values();
    const a = it.next().value;
    const b = it.next().value;
    if (a === undefined || b === undefined) return { x: 0, y: 0 };
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /** Select the nearest creature to a screen point (and follow it); empty space deselects. */
  private selectAt(sx: number, sy: number): void {
    const view = this.lastView;
    if (view === null) return;
    const wx = this.camera.screenToWorldX(sx);
    const wy = this.camera.screenToWorldY(sy);
    const pick = PICK_RADIUS_PX / this.camera.scale;
    let best = -1;
    let bestD = pick * pick;
    for (let i = 0; i < this.lastCount; i++) {
      const o = HEADER_LENGTH + i * AGENT_STRIDE;
      const dx = view[o + A_X] - wx;
      const dy = view[o + A_Y] - wy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best !== -1) {
      // Select for inspection, but do not adopt until the viewer presses Adopt.
      this.selectedId = view[HEADER_LENGTH + best * AGENT_STRIDE + A_ID];
      this.following = false;
      this.suspendCamera(); // hold still so the inspector can be read
    } else {
      this.selectedId = -1;
      this.following = false;
    }
  }
}
