import type { Bounds } from './camera.ts';
import type { ColourMode, QualityLevel } from './renderer.ts';

/**
 * The subset of renderer behaviour that `main.ts` and the UI depend on, so an
 * alternative render backend (the experimental OffscreenCanvas worker, v0.4.2)
 * can stand in for the default main-thread `Renderer`. The `Renderer` satisfies
 * this structurally — it is not modified to reference this type, so the default
 * render path is untouched (optional-capability principle, spec v0.4.0).
 */
export interface RenderSurface {
  draw(view: Float32Array, count: number): void;
  getSelectedId(): number;
  getFrameAte(): number;
  setFollowing(on: boolean): void;
  clearSelection(): void;
  setReducedMotion(on: boolean): void;
  isReducedMotion(): boolean;
  setColourMode(mode: ColourMode): void;
  getViewportBounds(): Bounds;
  centreCameraOn(worldX: number, worldY: number): void;
  setOverlayMode(mode: 'off' | 'fertility' | 'pheromone'): void;
  setPheromoneField(
    field: Float32Array,
    cols: number,
    rows: number,
    width: number,
    height: number,
  ): void;
  setPalette(index: number): void;
  setQuality(level: QualityLevel): void;
}
