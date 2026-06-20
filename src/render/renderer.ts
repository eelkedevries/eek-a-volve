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
  unpackStage,
  foodOffset,
  FOOD_STRIDE,
  FOOD_X,
  FOOD_Y,
  FOOD_TYPE,
  H_FOOD_COUNT,
} from '../core/snapshot.ts';
import { CreatureSprite } from './creatureSprite.ts';
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

/**
 * PixiJS v8 renderer (specification: Architecture → `render/`). Two strategies
 * share the stage: a detailed `Container` of `CreatureSprite`s for the intimate
 * **community** mode (legible bodies, eyes, and maws), and the batched
 * `ParticleContainer` of tinted dots for the large **swarm** mode. The view mode
 * (from the setup screen, prompt 030) chooses which is shown; the camera and
 * level-of-detail switching come in the next prompt. Food is drawn in both modes
 * as tinted dots, distinguished by type.
 */
export class Renderer {
  private app!: Application;
  private agents!: ParticleContainer;
  private creatureLayer!: Container;
  private foodLayer!: ParticleContainer;
  private texture!: Texture;
  private foodTexture!: Texture;
  private readonly particles: Particle[] = [];
  private readonly creatures: CreatureSprite[] = [];
  private readonly foodParticles: Particle[] = [];
  private mode: SimulationParameters['viewMode'] = 'community';
  private worldWidth = 1;
  private worldHeight = 1;

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

    // Draw order: food (back), swarm dots, detailed creatures (front).
    this.foodLayer = new ParticleContainer({
      dynamicProperties: { position: true, vertex: true, color: true },
    });
    this.agents = new ParticleContainer({
      dynamicProperties: { position: true, vertex: true, color: true },
    });
    this.creatureLayer = new Container();
    this.app.stage.addChild(this.foodLayer, this.agents, this.creatureLayer);
  }

  /** Draw a snapshot: food always, then the strategy chosen by the view mode. */
  draw(view: Float32Array, count: number): void {
    const sx = this.app.renderer.width / this.worldWidth;
    const sy = this.app.renderer.height / this.worldHeight;
    this.drawFood(view, count, sx, sy);
    if (this.mode === 'swarm') {
      this.creatureLayer.visible = false;
      this.agents.visible = true;
      this.drawSwarm(view, count, sx, sy);
    } else {
      this.agents.visible = false;
      this.creatureLayer.visible = true;
      this.drawCommunity(view, count, sx, sy);
    }
  }

  /** Community strategy: a pooled detailed creature per visible agent. */
  private drawCommunity(view: Float32Array, count: number, sx: number, sy: number): void {
    const pxPerUnit = Math.min(sx, sy);
    while (this.creatures.length < count) {
      const c = new CreatureSprite();
      this.creatures.push(c);
      this.creatureLayer.addChild(c.view);
    }
    for (let i = 0; i < this.creatures.length; i++) {
      const c = this.creatures[i];
      if (i < count) {
        const o = HEADER_LENGTH + i * AGENT_STRIDE;
        c.update(
          view[o + A_X] * sx,
          view[o + A_Y] * sy,
          view[o + A_HEADING],
          view[o + A_SCALE],
          view[o + A_DIET],
          view[o + A_SENSE],
          unpackStage(view[o + A_STATE]),
          colourFor(view[o + A_COLOUR] | 0),
          pxPerUnit,
        );
      } else {
        c.hide();
      }
    }
  }

  /** Swarm strategy: batched tinted dots (unchanged from the simple renderer). */
  private drawSwarm(view: Float32Array, count: number, sx: number, sy: number): void {
    this.ensureParticles(count);
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (i < count) {
        const o = HEADER_LENGTH + i * AGENT_STRIDE;
        p.x = view[o + A_X] * sx;
        p.y = view[o + A_Y] * sy;
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

  /** Food: tinted dots, larger and browner for carrion than for plants. */
  private drawFood(view: Float32Array, count: number, sx: number, sy: number): void {
    const foodCount = view[H_FOOD_COUNT] | 0;
    const base = foodOffset(count);
    this.ensureFood(foodCount);
    for (let i = 0; i < this.foodParticles.length; i++) {
      const p = this.foodParticles[i];
      if (i < foodCount) {
        const o = base + i * FOOD_STRIDE;
        p.x = view[o + FOOD_X] * sx;
        p.y = view[o + FOOD_Y] * sy;
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

  /** Grow the agent-dot pool to cover at least `count` agents. */
  private ensureParticles(count: number): void {
    while (this.particles.length < count) {
      const p = new Particle(this.texture);
      p.anchorX = 0.5;
      p.anchorY = 0.5;
      this.particles.push(p);
      this.agents.addParticle(p);
    }
  }

  /** Grow the food-dot pool to cover at least `count` food items. */
  private ensureFood(count: number): void {
    while (this.foodParticles.length < count) {
      const p = new Particle(this.foodTexture);
      p.anchorX = 0.5;
      p.anchorY = 0.5;
      this.foodParticles.push(p);
      this.foodLayer.addParticle(p);
    }
  }
}
