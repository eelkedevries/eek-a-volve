import {
  Application,
  Container,
  ParticleContainer,
  Particle,
  Graphics,
  type Texture,
} from 'pixi.js';
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
  unpackStage,
  unpackAction,
  foodOffset,
  FOOD_STRIDE,
  FOOD_X,
  FOOD_Y,
  FOOD_TYPE,
  H_FOOD_COUNT,
} from '../core/snapshot.ts';
import { CreatureSprite } from './creatureSprite.ts';
import { Camera, type Bounds } from './camera.ts';
import { Effects } from './effects.ts';
import { EATING, HUNTING, FLEEING, COURTING } from '../core/state.ts';
import type { SimulationParameters } from '../core/params.ts';

/** Palette indexed by species colour index; -1 (unassigned/immigrant) renders pale grey. */
const SPECIES_COLOURS = [
  0xff5d5d, 0x5dff7a, 0x5d9bff, 0xffd14d, 0xc77dff, 0x46d8c4, 0xff8fc4, 0x9aa7b4,
];

function colourFor(index: number): number {
  if (index < 0) return 0xdddddd;
  return SPECIES_COLOURS[index % SPECIES_COLOURS.length];
}

/** Food tints by type: green plants, muted brown carrion. */
const PLANT_COLOUR = 0x6abf52;
const CARRION_COLOUR = 0x9c6b3f;

/** In swarm mode, zoom at or beyond this switches the on-screen subset to detailed creatures. */
const SWARM_DETAIL_ZOOM = 1.5;
/** Hard cap on detailed creature objects per frame (the rest stay batched/culled). */
const MAX_DETAILED = 600;
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

/** Per-agent bookkeeping for spotting births, deaths, and action transitions. */
interface AgentTrace {
  action: number;
  x: number;
  y: number;
  seen: number;
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
  private mode: SimulationParameters['viewMode'] = 'community';
  private worldWidth = 1;
  private worldHeight = 1;

  // Behaviour-cue bookkeeping: previous-frame trace per stable id, and a frame counter.
  private readonly trace = new Map<number, AgentTrace>();
  private frameNo = 0;
  private lastDraw = 0;

  // Latest snapshot, kept so pointer events can pick and follow between frames.
  private lastView: Float32Array | null = null;
  private lastCount = 0;
  private selectedId = -1;
  private following = false;
  private userAdjusted = false;

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

    this.camera.fit(worldWidth, worldHeight, this.app.renderer.width, this.app.renderer.height);
    this.lastDraw = performance.now();
    this.setupInteraction();
  }

  /** The stable id of the selected creature, or -1 (for the inspector, later). */
  getSelectedId(): number {
    return this.selectedId;
  }

  /** Draw a snapshot: keep it for picking, move the camera, then food + the LOD strategy. */
  draw(view: Float32Array, count: number): void {
    this.lastView = view;
    this.lastCount = count;
    const vw = this.app.renderer.width;
    const vh = this.app.renderer.height;

    // Until the viewer touches the camera, keep the whole world fitted (also on resize).
    if (!this.userAdjusted && !this.following) {
      this.camera.fit(this.worldWidth, this.worldHeight, vw, vh);
    }

    if (this.following && this.selectedId !== -1) {
      const idx = this.findById(this.selectedId);
      if (idx === -1) {
        this.following = false;
        this.selectedId = -1;
      } else {
        const o = HEADER_LENGTH + idx * AGENT_STRIDE;
        this.camera.centreOn(view[o + A_X], view[o + A_Y], vw, vh);
      }
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
      this.agents.visible = false;
      this.creatureLayer.visible = true;
      this.drawDetailed(view, count, bounds);
    } else {
      this.creatureLayer.visible = false;
      this.agents.visible = true;
      this.drawSwarmHaze(view, count);
    }

    const now = performance.now();
    const dt = Math.min((now - this.lastDraw) / 1000, MAX_EFFECT_DT);
    this.lastDraw = now;
    this.updateEffects(view, count, detailed, dt);
  }

  /**
   * Spawn behaviour cues from snapshot state. New stable ids are births (with a
   * parent→newborn line); ids that vanish are deaths; an action that changes into
   * eating/hunting/fleeing/courting fires its cue once (only while creatures are
   * shown in detail, so a zoomed-out haze does not flood the pool).
   */
  private updateEffects(view: Float32Array, count: number, detailed: boolean, dt: number): void {
    const f = ++this.frameNo;
    for (let i = 0; i < count; i++) {
      const o = HEADER_LENGTH + i * AGENT_STRIDE;
      const id = view[o + A_ID];
      const x = view[o + A_X];
      const y = view[o + A_Y];
      const action = unpackAction(view[o + A_STATE]);
      const e = this.trace.get(id);
      if (e === undefined) {
        this.trace.set(id, { action, x, y, seen: f });
        this.effects.spawnBirth(x, y);
        if (this.effects.canLineage()) {
          const parent = this.findParent(view, count, i, x, y);
          if (parent !== -1) this.effects.spawnLineage(parent, id);
        }
      } else {
        if (detailed && action !== e.action) {
          if (action === EATING) this.effects.spawnMunch(x, y);
          else if (action === HUNTING) this.effects.spawnHunt(x, y);
          else if (action === FLEEING) this.effects.spawnFlee(x, y, view[o + A_HEADING]);
          else if (action === COURTING) this.effects.spawnCourt(x, y);
        }
        e.action = action;
        e.x = x;
        e.y = y;
        e.seen = f;
      }
    }
    for (const [id, e] of this.trace) {
      if (e.seen !== f) {
        this.effects.spawnDeath(e.x, e.y);
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

  /** Detailed creatures for the visible, capped subset; surplus pool objects hidden. */
  private drawDetailed(view: Float32Array, count: number, bounds: Bounds): void {
    let used = 0;
    for (let i = 0; i < count && used < MAX_DETAILED; i++) {
      const o = HEADER_LENGTH + i * AGENT_STRIDE;
      const wx = view[o + A_X];
      const wy = view[o + A_Y];
      if (wx < bounds.minX || wx > bounds.maxX || wy < bounds.minY || wy > bounds.maxY) continue;
      this.creatureAt(used++).update(
        wx,
        wy,
        view[o + A_HEADING],
        view[o + A_SCALE],
        view[o + A_DIET],
        view[o + A_SENSE],
        unpackStage(view[o + A_STATE]),
        colourFor(view[o + A_COLOUR] | 0),
        1,
      );
    }
    for (let i = used; i < this.creatures.length; i++) this.creatures[i].hide();
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
        this.userAdjusted = true;
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
        this.userAdjusted = true;
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
    this.userAdjusted = true;
  };

  private readonly onDoubleClick = (): void => {
    this.following = false;
    this.userAdjusted = false; // resume auto-fit
    this.camera.fit(this.worldWidth, this.worldHeight, this.app.renderer.width, this.app.renderer.height);
  };

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
      this.selectedId = view[HEADER_LENGTH + best * AGENT_STRIDE + A_ID];
      this.following = true;
    } else {
      this.selectedId = -1;
      this.following = false;
    }
  }
}
