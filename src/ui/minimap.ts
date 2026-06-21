import type { Bounds } from '../render/camera.ts';
import { HEADER_LENGTH, AGENT_STRIDE, A_X, A_Y } from '../core/snapshot.ts';

export interface Minimap {
  element: HTMLElement;
  /** Redraw from the latest snapshot view, live count, and camera viewport. */
  update(view: Float32Array, count: number, viewport: Bounds): void;
  /** Redraw the last view at the current size (called when the window resizes). */
  resize(): void;
}

/** Cap on dots drawn, so swarm scale stays cheap (agents are downsampled). */
const MAX_DOTS = 1500;

/**
 * The world-map body (design: "Map"). Draws the whole world letterboxed to fill
 * the window, agents as faint dots and the camera's viewport as a rectangle;
 * clicking recentres the main camera. Pure main-thread UI fed from the snapshot,
 * downsampled and capped for swarm scale.
 */
export function createMinimap(
  worldWidth: number,
  worldHeight: number,
  onRecentre: (worldX: number, worldY: number) => void,
): Minimap {
  const element = document.createElement('div');
  element.className = 'ev-map';

  const canvas = document.createElement('canvas');
  canvas.className = 'ev-map-canvas';
  element.appendChild(canvas);

  // Letterbox transform, recomputed each draw from the live canvas size.
  let scale = 1;
  let offX = 0;
  let offY = 0;
  let lastView: Float32Array | null = null;
  let lastCount = 0;
  let lastViewport: Bounds | null = null;

  function fit(cw: number, ch: number): void {
    scale = Math.min(cw / worldWidth, ch / worldHeight);
    offX = (cw - worldWidth * scale) / 2;
    offY = (ch - worldHeight * scale) / 2;
  }

  function draw(view: Float32Array, count: number, viewport: Bounds): void {
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(1, canvas.clientWidth);
    const ch = Math.max(1, canvas.clientHeight);
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    fit(cw, ch);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(offX, offY, worldWidth * scale, worldHeight * scale);

    const step = count > MAX_DOTS ? Math.ceil(count / MAX_DOTS) : 1;
    ctx.fillStyle = 'rgba(92, 255, 143, 0.7)';
    for (let i = 0; i < count; i += step) {
      const o = HEADER_LENGTH + i * AGENT_STRIDE;
      ctx.fillRect(offX + view[o + A_X] * scale, offY + view[o + A_Y] * scale, 1.5, 1.5);
    }

    const x0 = offX + Math.max(0, viewport.minX) * scale;
    const y0 = offY + Math.max(0, viewport.minY) * scale;
    const x1 = offX + Math.min(worldWidth, viewport.maxX) * scale;
    const y1 = offY + Math.min(worldHeight, viewport.maxY) * scale;
    ctx.strokeStyle = 'rgba(169, 196, 255, 0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }

  function recentreFromEvent(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * Math.max(1, canvas.clientWidth);
    const py = ((e.clientY - rect.top) / rect.height) * Math.max(1, canvas.clientHeight);
    onRecentre((px - offX) / scale, (py - offY) / scale);
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
      lastView = view;
      lastCount = count;
      lastViewport = viewport;
      draw(view, count, viewport);
    },
    resize: (): void => {
      if (lastView !== null && lastViewport !== null) draw(lastView, lastCount, lastViewport);
    },
  };
}
