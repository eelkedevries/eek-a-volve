import type { Bounds } from '../render/camera.ts';
import {
  HEADER_LENGTH,
  AGENT_STRIDE,
  A_X,
  A_Y,
} from '../core/snapshot.ts';

export interface Minimap {
  element: HTMLElement;
  /** Redraw from the latest snapshot view, live count, and camera viewport. */
  update(view: Float32Array, count: number, viewport: Bounds): void;
}

/** Canvas size in CSS pixels (square-ish; world is letterboxed into it). */
const SIZE = 150;
/** Cap on dots drawn, so swarm scale stays cheap (agents are downsampled). */
const MAX_DOTS = 1200;

/**
 * A small overview map (specification: render/ legibility — navigating large
 * worlds). Draws the whole world with agents as faint dots and the camera's
 * viewport as a rectangle; clicking or dragging recentres the main camera. Pure
 * main-thread UI fed from the snapshot; downsampled and capped for swarm scale.
 */
export function createMinimap(
  worldWidth: number,
  worldHeight: number,
  onRecentre: (worldX: number, worldY: number) => void,
): Minimap {
  const element = document.createElement('div');
  element.className = 'minimap';

  const canvas = document.createElement('canvas');
  // Letterbox the world into a SIZE×SIZE box, preserving aspect.
  const aspect = worldWidth / worldHeight;
  const w = aspect >= 1 ? SIZE : Math.round(SIZE * aspect);
  const h = aspect >= 1 ? Math.round(SIZE / aspect) : SIZE;
  canvas.width = w;
  canvas.height = h;
  element.appendChild(canvas);

  const sx = w / worldWidth;
  const sy = h / worldHeight;

  function recentreFromEvent(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const py = ((e.clientY - rect.top) / rect.height) * h;
    onRecentre(px / sx, py / sy);
  }

  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    recentreFromEvent(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) recentreFromEvent(e);
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    canvas.releasePointerCapture(e.pointerId);
  });

  return {
    element,
    update: (view, count, viewport): void => {
      if (element.classList.contains('hidden')) return;
      const ctx = canvas.getContext('2d');
      if (ctx === null) return;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, w, h);

      // Agents as faint dots, downsampled to a cap for large populations.
      const step = count > MAX_DOTS ? Math.ceil(count / MAX_DOTS) : 1;
      ctx.fillStyle = 'rgba(92, 255, 143, 0.7)';
      for (let i = 0; i < count; i += step) {
        const o = HEADER_LENGTH + i * AGENT_STRIDE;
        ctx.fillRect(view[o + A_X] * sx, view[o + A_Y] * sy, 1.5, 1.5);
      }

      // Camera viewport rectangle.
      const x0 = Math.max(0, viewport.minX * sx);
      const y0 = Math.max(0, viewport.minY * sy);
      const x1 = Math.min(w, viewport.maxX * sx);
      const y1 = Math.min(h, viewport.maxY * sy);
      ctx.strokeStyle = 'rgba(255, 209, 77, 0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    },
  };
}
