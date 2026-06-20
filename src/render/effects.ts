import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';

/** Maximum concurrent sprite cues; spawning beyond this recycles the oldest. */
const POOL_SIZE = 320;
/** Maximum concurrent parent→newborn lineage lines. */
const LINE_POOL = 48;
/** Motion-trail stamps; a ring buffer, so emitting never allocates or starves cues. */
const TRAIL_POOL = 420;

/** Cue tints (roles, not species). */
const MUNCH_COLOUR = 0xffe08a;
const CRUMB_COLOUR = 0xc9a24b;
const HUNT_COLOUR = 0xff5247;
const SPLAT_COLOUR = 0x7a1414;
const FLEE_COLOUR = 0x7fe3ff;
const COURT_COLOUR = 0xff8fc4;
const BIRTH_COLOUR = 0xbfffd0;
const DEATH_COLOUR = 0x9aa7b4;
const LINEAGE_COLOUR = 0xfff2a8;

interface EffectItem {
  sprite: Sprite;
  active: boolean;
  age: number;
  ttl: number;
  vx: number;
  vy: number;
  scale0: number;
  scale1: number;
  alpha0: number;
  alpha1: number;
  spin: number;
}

interface LineItem {
  g: Graphics;
  active: boolean;
  age: number;
  ttl: number;
  parentId: number;
  childId: number;
}

/** Minimal current-position lookup the lineage lines read each frame. */
export interface PositionLookup {
  get(id: number): { x: number; y: number } | undefined;
}

/**
 * Pooled, short-lived behaviour cues (specification: render/ — recognisable
 * behaviour). The renderer spawns a cue when it sees the matching snapshot state
 * — eating, hunting, fleeing, courting — and on the birth/death of an agent. All
 * display objects are pooled and capped, so nothing allocates per frame once the
 * pools are warm. Lineage lines are redrawn each frame from live positions so a
 * fresh parent–child link reads at a glance.
 */
export class Effects {
  readonly view = new Container();
  private readonly items: EffectItem[] = [];
  private readonly lines: LineItem[] = [];
  private readonly trails: EffectItem[] = [];
  private cursor = 0;
  private trailCursor = 0;

  private readonly dotTex: Texture;
  private readonly ringTex: Texture;
  private readonly heartTex: Texture;
  private readonly dartTex: Texture;

  constructor(renderer: Renderer) {
    const dot = new Graphics().circle(0, 0, 4).fill(0xffffff);
    this.dotTex = renderer.generateTexture(dot);
    dot.destroy();

    const ring = new Graphics().circle(0, 0, 9).stroke({ width: 2.5, color: 0xffffff });
    this.ringTex = renderer.generateTexture(ring);
    ring.destroy();

    const heart = new Graphics();
    heart.circle(-3, -2, 4).circle(3, -2, 4).fill(0xffffff);
    heart.poly([-7, -1, 7, -1, 0, 9]).fill(0xffffff);
    this.heartTex = renderer.generateTexture(heart);
    heart.destroy();

    const dart = new Graphics().poly([0, -2.5, 10, 0, 0, 2.5]).fill(0xffffff);
    this.dartTex = renderer.generateTexture(dart);
    dart.destroy();

    // Trails sit at the very back, behind lineage lines and cues.
    const trailLayer = new Container();
    for (let i = 0; i < TRAIL_POOL; i++) {
      const sprite = new Sprite(this.dotTex);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.trails.push(this.blankItem(sprite));
      trailLayer.addChild(sprite);
    }
    this.view.addChild(trailLayer);

    const lineLayer = new Container();
    for (let i = 0; i < LINE_POOL; i++) {
      const g = new Graphics();
      g.visible = false;
      this.lines.push({ g, active: false, age: 0, ttl: 1, parentId: 0, childId: 0 });
      lineLayer.addChild(g);
    }
    this.view.addChild(lineLayer);

    for (let i = 0; i < POOL_SIZE; i++) {
      const sprite = new Sprite(this.dotTex);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.items.push(this.blankItem(sprite));
      this.view.addChild(sprite);
    }
  }

  private blankItem(sprite: Sprite): EffectItem {
    return {
      sprite,
      active: false,
      age: 0,
      ttl: 1,
      vx: 0,
      vy: 0,
      scale0: 1,
      scale1: 1,
      alpha0: 1,
      alpha1: 0,
      spin: 0,
    };
  }

  // --- Cue spawners (composed from one or more pooled sprites) ---

  /** Eating: a warm munch ring and a small crumb scatter. */
  spawnMunch(x: number, y: number): void {
    this.emit(this.ringTex, x, y, MUNCH_COLOUR, 0.3, 1.2, 0.9, 0, 0.4, 0, 0, 0);
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 40;
      this.emit(this.dotTex, x, y, CRUMB_COLOUR, 0.5, 0.2, 1, 0, 0.4, Math.cos(a) * sp, Math.sin(a) * sp, 0);
    }
  }

  /** Hunting: a red chomp flash and a splat. */
  spawnHunt(x: number, y: number): void {
    this.emit(this.ringTex, x, y, HUNT_COLOUR, 0.4, 1.7, 1, 0, 0.35, 0, 0, 0);
    this.emit(this.dotTex, x, y, SPLAT_COLOUR, 0.6, 1.6, 0.9, 0, 0.45, 0, 0, 0);
  }

  /** Fleeing: a quick dart streak in the heading direction. */
  spawnFlee(x: number, y: number, heading: number): void {
    const it = this.emit(this.dartTex, x, y, FLEE_COLOUR, 0.7, 1.1, 0.9, 0, 0.3, Math.cos(heading) * 70, Math.sin(heading) * 70, 0);
    it.sprite.rotation = heading;
  }

  /** Courting: a pink heart that drifts up and fades (marks the pairing moment). */
  spawnCourt(x: number, y: number): void {
    this.emit(this.heartTex, x, y - 4, COURT_COLOUR, 0.4, 1.0, 1, 0, 0.7, 0, -22, 0);
  }

  /** Birth: a bright sparkle pop. */
  spawnBirth(x: number, y: number): void {
    this.emit(this.ringTex, x, y, BIRTH_COLOUR, 0.2, 1.0, 1, 0, 0.5, 0, 0, 0);
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 35 + Math.random() * 35;
      this.emit(this.dotTex, x, y, BIRTH_COLOUR, 0.5, 0.1, 1, 0, 0.5, Math.cos(a) * sp, Math.sin(a) * sp, 0);
    }
  }

  /** Death: a grey puff of smoke. */
  spawnDeath(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 10 + Math.random() * 18;
      this.emit(this.dotTex, x, y, DEATH_COLOUR, 0.6, 1.5, 0.7, 0, 0.6, Math.cos(a) * sp, Math.sin(a) * sp, 0.5);
    }
  }

  /** Whether a lineage line can be started this frame (used to bound the parent search). */
  canLineage(): boolean {
    for (const l of this.lines) if (!l.active) return true;
    return false;
  }

  /** Start a parent→newborn lineage line, redrawn each frame from live positions. */
  spawnLineage(parentId: number, childId: number): void {
    for (const l of this.lines) {
      if (!l.active) {
        l.active = true;
        l.age = 0;
        l.ttl = 1.1;
        l.parentId = parentId;
        l.childId = childId;
        l.g.visible = true;
        return;
      }
    }
  }

  /**
   * Drop a fading motion-trail stamp at a position (ring-buffered, so it never
   * allocates and cannot starve the cue pool). The renderer calls this for fast
   * movers only, and not at all under reduced motion.
   */
  spawnTrail(x: number, y: number, tint: number): void {
    const it = this.trails[this.trailCursor];
    this.trailCursor = (this.trailCursor + 1) % this.trails.length;
    const s = it.sprite;
    s.texture = this.dotTex;
    s.tint = tint;
    s.x = x;
    s.y = y;
    s.rotation = 0;
    s.scale.set(0.6);
    s.alpha = 0.4;
    s.visible = true;
    it.active = true;
    it.age = 0;
    it.ttl = 0.3;
    it.vx = 0;
    it.vy = 0;
    it.scale0 = 0.6;
    it.scale1 = 0.2;
    it.alpha0 = 0.4;
    it.alpha1 = 0;
    it.spin = 0;
  }

  /** Advance every active cue/trail by `dt` seconds; redraw lineage lines from `positions`. */
  update(dt: number, positions: PositionLookup): void {
    for (const it of this.items) this.advance(it, dt);
    for (const it of this.trails) this.advance(it, dt);

    for (const l of this.lines) {
      if (!l.active) continue;
      l.age += dt;
      const t = l.age / l.ttl;
      const a = positions.get(l.parentId);
      const b = positions.get(l.childId);
      if (t >= 1 || a === undefined || b === undefined) {
        l.active = false;
        l.g.visible = false;
        l.g.clear();
        continue;
      }
      l.g.clear();
      l.g
        .moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({ width: 1.5, color: LINEAGE_COLOUR, alpha: 0.8 * (1 - t) });
    }
  }

  /** Step one pooled sprite item's animation; deactivate when its life is spent. */
  private advance(it: EffectItem, dt: number): void {
    if (!it.active) return;
    it.age += dt;
    const t = it.age / it.ttl;
    if (t >= 1) {
      it.active = false;
      it.sprite.visible = false;
      return;
    }
    const s = it.sprite;
    s.x += it.vx * dt;
    s.y += it.vy * dt;
    s.scale.set(it.scale0 + (it.scale1 - it.scale0) * t);
    s.alpha = it.alpha0 + (it.alpha1 - it.alpha0) * t;
    s.rotation += it.spin * dt;
  }

  private emit(
    tex: Texture,
    x: number,
    y: number,
    tint: number,
    scale0: number,
    scale1: number,
    alpha0: number,
    alpha1: number,
    ttl: number,
    vx: number,
    vy: number,
    spin: number,
  ): EffectItem {
    const it = this.take();
    const s = it.sprite;
    s.texture = tex;
    s.tint = tint;
    s.x = x;
    s.y = y;
    s.rotation = 0;
    s.scale.set(scale0);
    s.alpha = alpha0;
    s.visible = true;
    it.active = true;
    it.age = 0;
    it.ttl = ttl;
    it.vx = vx;
    it.vy = vy;
    it.scale0 = scale0;
    it.scale1 = scale1;
    it.alpha0 = alpha0;
    it.alpha1 = alpha1;
    it.spin = spin;
    return it;
  }

  /** A free pool slot, or the oldest active one recycled (caps concurrent cues). */
  private take(): EffectItem {
    const n = this.items.length;
    for (let k = 0; k < n; k++) {
      const idx = (this.cursor + k) % n;
      if (!this.items[idx].active) {
        this.cursor = (idx + 1) % n;
        return this.items[idx];
      }
    }
    let oldest = 0;
    let oldestT = -1;
    for (let k = 0; k < n; k++) {
      const t = this.items[k].age / this.items[k].ttl;
      if (t > oldestT) {
        oldestT = t;
        oldest = k;
      }
    }
    this.cursor = (oldest + 1) % n;
    return this.items[oldest];
  }
}
