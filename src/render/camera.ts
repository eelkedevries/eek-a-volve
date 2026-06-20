import type { Container } from 'pixi.js';

/** Zoom limits, so the world can neither vanish nor fill the screen with one creature. */
const MIN_SCALE = 0.05;
const MAX_SCALE = 40;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Axis-aligned world rectangle (used for off-screen culling). */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * A 2-D camera over the Pixi world container: `screen = world * scale + offset`.
 * Pure state and maths — the renderer attaches DOM events that call these methods
 * and applies the result to the world container each frame (specification:
 * render/ — camera, pan/zoom/follow).
 */
export class Camera {
  scale = 1;
  /** Screen-space translation. */
  x = 0;
  y = 0;

  /** Apply the camera as the world container's transform. */
  applyTo(container: Container): void {
    container.x = this.x;
    container.y = this.y;
    container.scale.set(this.scale);
  }

  screenToWorldX(sx: number): number {
    return (sx - this.x) / this.scale;
  }

  screenToWorldY(sy: number): number {
    return (sy - this.y) / this.scale;
  }

  worldToScreenX(wx: number): number {
    return wx * this.scale + this.x;
  }

  worldToScreenY(wy: number): number {
    return wy * this.scale + this.y;
  }

  /** Pan by a screen-space delta (drag). */
  panBy(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  /** Zoom by `factor` about a screen point, keeping that point fixed (wheel/pinch). */
  zoomAt(sx: number, sy: number, factor: number): void {
    const wx = this.screenToWorldX(sx);
    const wy = this.screenToWorldY(sy);
    this.scale = clamp(this.scale * factor, MIN_SCALE, MAX_SCALE);
    this.x = sx - wx * this.scale;
    this.y = sy - wy * this.scale;
  }

  /** Fit the whole world into the viewport, centred. */
  fit(worldW: number, worldH: number, viewW: number, viewH: number): void {
    this.scale = Math.min(viewW / worldW, viewH / worldH);
    this.x = (viewW - worldW * this.scale) / 2;
    this.y = (viewH - worldH * this.scale) / 2;
  }

  /** Centre the viewport on a world point, keeping the current zoom (follow). */
  centreOn(worldX: number, worldY: number, viewW: number, viewH: number): void {
    this.x = viewW / 2 - worldX * this.scale;
    this.y = viewH / 2 - worldY * this.scale;
  }

  /** The visible world rectangle for a viewport of the given size. */
  visibleBounds(viewW: number, viewH: number): Bounds {
    return {
      minX: this.screenToWorldX(0),
      minY: this.screenToWorldY(0),
      maxX: this.screenToWorldX(viewW),
      maxY: this.screenToWorldY(viewH),
    };
  }
}
