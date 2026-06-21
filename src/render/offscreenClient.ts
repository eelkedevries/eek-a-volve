import type { Bounds } from './camera.ts';
import type { ColourMode, QualityLevel } from './renderer.ts';
import type { RenderSurface } from './surface.ts';
import type { SimulationParameters } from '../core/params.ts';

/** True when the browser can render via OffscreenCanvas in a worker. */
export function isOffscreenSupported(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function'
  );
}

/**
 * Main-thread proxy for the experimental OffscreenCanvas render worker (spec
 * v0.4.2). Implements {@link RenderSurface} so it can stand in for the default
 * `Renderer`: it owns the on-screen canvas, forwards input and snapshots to the
 * worker, and mirrors back the selection and viewport bounds the UI reads. If the
 * worker errors at any point, the caller falls back to the main-thread renderer.
 */
export class OffscreenRenderClient implements RenderSurface {
  private worker: Worker | null = null;
  private canvas!: HTMLCanvasElement;
  private host!: HTMLElement;
  private selectedId = -1;
  private bounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  private reducedMotion = false;
  private onError: () => void = () => {};
  private disposed = false;

  /** Set up the canvas + worker. Resolves once the worker has been handed the
   *  canvas; rejects (so the caller can fall back) if anything throws. */
  async init(
    host: HTMLElement,
    worldWidth: number,
    worldHeight: number,
    _mode: SimulationParameters['viewMode'],
    palette: number,
    colourMode: ColourMode,
  ): Promise<void> {
    this.host = host;
    this.bounds = { minX: 0, minY: 0, maxX: worldWidth, maxY: worldHeight };
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    host.appendChild(canvas);
    this.canvas = canvas;

    const worker = new Worker(new URL('./offscreenWorker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;

    // Resolve only once the worker confirms PixiJS initialised ('ready'); reject on
    // 'failed', a worker error, or a timeout, so the caller can fall back to main.
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (ok) resolve();
        else reject(new Error('offscreen init failed'));
      };
      const timer = setTimeout(() => done(false), 8000);
      worker.onmessage = (e: MessageEvent): void => {
        const m = e.data;
        if (m.type === 'ready') done(true);
        else if (m.type === 'failed') done(false);
        else if (m.type === 'state') {
          this.selectedId = m.selectedId;
          if (m.bounds) this.bounds = m.bounds;
        }
      };
      worker.onerror = (): void => {
        if (settled) this.fail();
        else done(false);
      };

      const rect = host.getBoundingClientRect();
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage(
        {
          type: 'init',
          canvas: offscreen,
          worldWidth,
          worldHeight,
          width: Math.max(1, Math.floor(rect.width)),
          height: Math.max(1, Math.floor(rect.height)),
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          palette,
          colourMode,
        },
        [offscreen],
      );
    });

    this.attachInput();
    window.addEventListener('resize', this.onResize);
  }

  /** Register a callback used if the worker fails after init (fall back to main). */
  setErrorHandler(fn: () => void): void {
    this.onError = fn;
  }

  private fail(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.onError();
  }

  private post(msg: Record<string, unknown>, transfer?: Transferable[]): void {
    if (this.disposed || this.worker === null) return;
    try {
      this.worker.postMessage(msg, transfer ?? []);
    } catch {
      this.fail();
    }
  }

  private canvasXY(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private attachInput(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const p = this.canvasXY(e);
      this.post({ type: 'pointerdown', x: p.x, y: p.y, button: e.button });
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.canvasXY(e);
      this.post({ type: 'pointermove', x: p.x, y: p.y, buttons: e.buttons });
    });
    const up = (e: PointerEvent): void => {
      const p = this.canvasXY(e);
      this.post({ type: 'pointerup', x: p.x, y: p.y });
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const p = this.canvasXY(e);
        this.post({ type: 'wheel', x: p.x, y: p.y, deltaY: e.deltaY });
      },
      { passive: false },
    );
  }

  private onResize = (): void => {
    const r = this.host.getBoundingClientRect();
    this.post({ type: 'resize', width: Math.max(1, Math.floor(r.width)), height: Math.max(1, Math.floor(r.height)) });
  };

  // --- RenderSurface ---

  draw(view: Float32Array, count: number): void {
    if (this.disposed) return;
    const copy = view.slice();
    this.post({ type: 'frame', view: copy, count }, [copy.buffer]);
  }

  getSelectedId(): number {
    return this.selectedId;
  }

  getFrameAte(): number {
    return 0; // Eating cues are simplified in the experimental offscreen path.
  }

  setFollowing(on: boolean): void {
    this.post({ type: 'set', key: 'following', value: on });
  }

  clearSelection(): void {
    this.selectedId = -1;
    this.post({ type: 'set', key: 'clearSelection' });
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
  }

  isReducedMotion(): boolean {
    return this.reducedMotion;
  }

  setColourMode(mode: ColourMode): void {
    this.post({ type: 'set', key: 'colourMode', value: mode });
  }

  getViewportBounds(): Bounds {
    return this.bounds;
  }

  centreCameraOn(worldX: number, worldY: number): void {
    this.post({ type: 'set', key: 'centre', value: { x: worldX, y: worldY } });
  }

  setOverlayMode(_mode: 'off' | 'fertility' | 'pheromone'): void {
    // Field overlays are a main-path feature; simplified (absent) in offscreen mode.
  }

  setPheromoneField(
    _field: Float32Array,
    _cols: number,
    _rows: number,
    _width: number,
    _height: number,
  ): void {
    // No overlay in offscreen mode.
  }

  setPalette(index: number): void {
    this.post({ type: 'set', key: 'palette', value: index });
  }

  setQuality(_level: QualityLevel): void {
    // Detail tiers are a main-path feature; offscreen mode always batches particles.
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    this.worker?.terminate();
    this.worker = null;
    this.canvas?.remove();
  }
}
