import type { Bounds } from '../render/camera.ts';
import { HEADER_LENGTH, AGENT_STRIDE, A_X, A_Y, A_ID } from '../core/snapshot.ts';

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
 * the window, agents as faint dots and the camera's viewport as a rectangle.
 * Dragging recentres the main camera; a tap selects the nearest creature and
 * opens the Inspector — a reliable way to pick a creature without hunting for it
 * on the live canvas. Pure main-thread UI fed from the snapshot.
 */
export function createMinimap(
  worldWidth: number,
  worldHeight: number,
  onRecentre: (worldX: number, worldY: number) => void,
  onSelect: (id: number) => void,
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

  /** Map a pointer event to world coordinates via the current letterbox fit. */
  function worldPoint(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * Math.max(1, canvas.clientWidth);
    const py = ((e.clientY - rect.top) / rect.height) * Math.max(1, canvas.clientHeight);
    return { x: (px - offX) / scale, y: (py - offY) / scale };
  }

  function recentreFromEvent(e: PointerEvent): void {
    const { x, y } = worldPoint(e);
    onRecentre(x, y);
  }

  /** Select the nearest creature to a tapped point (by its stable id). */
  function selectFromEvent(e: PointerEvent): void {
    if (lastView === null) return;
    const { x, y } = worldPoint(e);
    let bestId = -1;
    let bestD = Infinity;
    for (let i = 0; i < lastCount; i++) {
      const o = HEADER_LENGTH + i * AGENT_STRIDE;
      const dx = lastView[o + A_X] - x;
      const dy = lastView[o + A_Y] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestId = lastView[o + A_ID];
      }
    }
    if (bestId >= 0) onSelect(bestId);
  }

  let dragging = false;
  let pressX = 0;
  let pressY = 0;
  let moved = false;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = false;
    pressX = e.clientX;
    pressY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    recentreFromEvent(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    if (Math.abs(e.clientX - pressX) + Math.abs(e.clientY - pressY) > 6) moved = true;
    recentreFromEvent(e);
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    canvas.releasePointerCapture(e.pointerId);
    if (!moved) selectFromEvent(e); // a tap (not a drag) picks the nearest creature
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
