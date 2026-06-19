import { Application, ParticleContainer, Particle, Graphics, type Texture } from 'pixi.js';
import { HEADER_LENGTH, AGENT_STRIDE } from '../core/snapshot.ts';

/** Palette indexed by species colour index; -1 (unassigned/immigrant) renders pale grey. */
const SPECIES_COLOURS = [
  0xff5d5d, 0x5dff7a, 0x5d9bff, 0xffd14d, 0xc77dff, 0x46d8c4, 0xff8fc4, 0x9aa7b4,
];

function colourFor(index: number): number {
  if (index < 0) return 0xdddddd;
  return SPECIES_COLOURS[index % SPECIES_COLOURS.length];
}

/**
 * PixiJS v8 renderer (specification: Architecture → `render/`). Agents are drawn
 * through a `ParticleContainer`, which batches a large number of same-texture
 * particles. PixiJS selects WebGPU automatically and falls back to WebGL2; no
 * WebGPU-specific code is written here.
 *
 * Food is not yet in the render snapshot, so only agents are drawn; food
 * rendering will follow once the snapshot carries it.
 */
export class Renderer {
  private app!: Application;
  private agents!: ParticleContainer;
  private texture!: Texture;
  private readonly particles: Particle[] = [];
  private worldWidth = 1;
  private worldHeight = 1;

  async init(mount: HTMLElement, worldWidth: number, worldHeight: number): Promise<void> {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    this.app = new Application();
    await this.app.init({ background: 0x101418, resizeTo: mount, antialias: true });
    mount.appendChild(this.app.canvas);

    const circle = new Graphics().circle(0, 0, 8).fill(0xffffff);
    this.texture = this.app.renderer.generateTexture(circle);
    circle.destroy();

    this.agents = new ParticleContainer({
      dynamicProperties: { position: true, vertex: true, color: true },
    });
    this.app.stage.addChild(this.agents);
  }

  /** Draw the live agents in a snapshot, reusing particles across frames. */
  draw(view: Float32Array, count: number): void {
    const sx = this.app.renderer.width / this.worldWidth;
    const sy = this.app.renderer.height / this.worldHeight;
    this.ensure(count);
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (i < count) {
        const o = HEADER_LENGTH + i * AGENT_STRIDE;
        p.x = view[o] * sx;
        p.y = view[o + 1] * sy;
        const scale = view[o + 3] * 0.5;
        p.scaleX = scale;
        p.scaleY = scale;
        p.tint = colourFor(view[o + 2] | 0);
      } else {
        // Hide surplus particles without removing them from the batch.
        p.scaleX = 0;
        p.scaleY = 0;
      }
    }
  }

  /** Grow the particle pool to cover at least `count` agents. */
  private ensure(count: number): void {
    while (this.particles.length < count) {
      const p = new Particle(this.texture);
      p.anchorX = 0.5;
      p.anchorY = 0.5;
      this.particles.push(p);
      this.agents.addParticle(p);
    }
  }
}
