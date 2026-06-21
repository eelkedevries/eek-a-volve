/// <reference lib="webworker" />
/**
 * Experimental OffscreenCanvas render worker (optional capability, spec v0.4.2).
 * Hosts a focused PixiJS scene — creatures and food as batched particles, with a
 * pan/zoom/click camera — on a transferred OffscreenCanvas, so heavy drawing runs
 * off the main thread. This is intentionally self-contained and DOM-free; it does
 * not reuse the main-thread `Renderer` (which is DOM-coupled and remains the
 * default and fallback). Rich effects, overlays, emotes, and the auto-director are
 * main-path features and are simplified or absent here.
 */
import {
  Application,
  Container,
  ParticleContainer,
  Particle,
  Graphics,
  DOMAdapter,
  WebWorkerAdapter,
  type Texture,
} from 'pixi.js';
import {
  HEADER_LENGTH,
  AGENT_STRIDE,
  A_X,
  A_Y,
  A_COLOUR,
  A_SCALE,
  A_DIET,
  A_SENSE,
  A_ID,
  foodOffset,
  FOOD_STRIDE,
  FOOD_X,
  FOOD_Y,
  FOOD_TYPE,
  H_FOOD_COUNT,
} from '../core/snapshot.ts';
import { SIZE, TRAIT_RANGES } from '../core/genome.ts';
import { Camera } from './camera.ts';

// Palette colours mirror render/renderer.ts PALETTES (kept inline to stay DOM-free).
const PALETTES = [
  [0xff5d5d, 0x5dff7a, 0x5d9bff, 0xffd14d, 0xc77dff, 0x46d8c4, 0xff8fc4, 0x9aa7b4],
  [0xe69f00, 0x56b4e9, 0x009e73, 0xf0e442, 0x0072b2, 0xd55e00, 0xcc79a7, 0xbbbbbb],
];
const PLANT_COLOUR = 0x6abf52;
const CARRION_COLOUR = 0x9c6b3f;
const TRAIT_RAMP = [0x440154, 0x31688e, 0x35b779, 0xfde725];
const PICK_RADIUS_PX = 16;
const CLICK_SLOP = 5;

type ColourMode = 'species' | 'diet' | 'size' | 'sense';

function rampColour(t: number): number {
  const x = (t < 0 ? 0 : t > 1 ? 1 : t) * (TRAIT_RAMP.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = TRAIT_RAMP[i];
  const b = TRAIT_RAMP[Math.min(i + 1, TRAIT_RAMP.length - 1)];
  const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * f);
  const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * f);
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * f);
  return (r << 16) | (g << 8) | bl;
}

let app: Application | null = null;
let world: Container;
let agents: ParticleContainer;
let foodLayer: ParticleContainer;
let texture: Texture;
let foodTexture: Texture;
const camera = new Camera();
const particles: Particle[] = [];
const foodParticles: Particle[] = [];

let palette = PALETTES[0];
let colourMode: ColourMode = 'species';
let viewW = 1;
let viewH = 1;
let worldW = 1;
let worldH = 1;
let lastView: Float32Array | null = null;
let lastCount = 0;
let selectedId = -1;
let followId = -1;

// Pointer state for pan vs click discrimination.
let pointerDown = false;
let dragged = false;
let lastPx = 0;
let lastPy = 0;
let downX = 0;
let downY = 0;

function colourFor(index: number): number {
  if (index < 0) return 0xdddddd;
  return palette[index % palette.length];
}

function bodyColour(view: Float32Array, o: number): number {
  switch (colourMode) {
    case 'diet':
      return rampColour(view[o + A_DIET]);
    case 'sense':
      return rampColour(view[o + A_SENSE]);
    case 'size': {
      const r = TRAIT_RANGES[SIZE];
      return rampColour((view[o + A_SCALE] - r.min) / (r.max - r.min));
    }
    default:
      return colourFor(view[o + A_COLOUR] | 0);
  }
}

async function init(msg: {
  canvas: OffscreenCanvas;
  worldWidth: number;
  worldHeight: number;
  width: number;
  height: number;
  resolution: number;
  palette: number;
  colourMode: ColourMode;
}): Promise<void> {
  worldW = msg.worldWidth;
  worldH = msg.worldHeight;
  viewW = Math.max(1, msg.width);
  viewH = Math.max(1, msg.height);
  palette = PALETTES[msg.palette] ?? PALETTES[0];
  colourMode = msg.colourMode;

  // PixiJS defaults to a DOM-based adapter (document.createElement); inside a
  // Web Worker there is no document, so switch to the worker adapter (which uses
  // OffscreenCanvas) before initialising the renderer.
  DOMAdapter.set(WebWorkerAdapter);
  app = new Application();
  await app.init({
    canvas: msg.canvas,
    width: viewW,
    height: viewH,
    resolution: msg.resolution,
    autoDensity: false,
    background: 0x101418,
    antialias: true,
  });
  // A dedicated worker has no requestAnimationFrame, so PixiJS's ticker cannot
  // drive rendering. Stop it and render explicitly (push-driven) on each frame
  // and camera change instead — see frame()/redraw().
  app.ticker.stop();

  const circle = new Graphics().circle(0, 0, 8).fill(0xffffff);
  texture = app.renderer.generateTexture(circle);
  circle.destroy();
  const dot = new Graphics().circle(0, 0, 4).fill(0xffffff);
  foodTexture = app.renderer.generateTexture(dot);
  dot.destroy();

  world = new Container();
  foodLayer = new ParticleContainer({ dynamicProperties: { position: true, vertex: true, color: true } });
  agents = new ParticleContainer({ dynamicProperties: { position: true, vertex: true, color: true } });
  world.addChild(foodLayer, agents);
  app.stage.addChild(world);

  camera.fit(worldW, worldH, viewW, viewH);
  redraw();
  post();
  (self as unknown as Worker).postMessage({ type: 'ready' });
}

self.onerror = (): void => {
  (self as unknown as Worker).postMessage({ type: 'failed' });
};

function ensureParticles(count: number): void {
  while (particles.length < count) {
    const p = new Particle(texture);
    p.anchorX = 0.5;
    p.anchorY = 0.5;
    particles.push(p);
    agents.addParticle(p);
  }
}

function ensureFood(count: number): void {
  while (foodParticles.length < count) {
    const p = new Particle(foodTexture);
    p.anchorX = 0.5;
    p.anchorY = 0.5;
    foodParticles.push(p);
    foodLayer.addParticle(p);
  }
}

function frame(view: Float32Array, count: number): void {
  if (app === null) return;
  lastView = view;
  lastCount = count;

  if (followId !== -1) {
    const idx = findById(followId);
    if (idx !== -1) {
      const o = HEADER_LENGTH + idx * AGENT_STRIDE;
      camera.centreOn(view[o + A_X], view[o + A_Y], viewW, viewH);
    }
  }
  camera.applyTo(world);

  ensureParticles(count);
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (i < count) {
      const o = HEADER_LENGTH + i * AGENT_STRIDE;
      p.x = view[o + A_X];
      p.y = view[o + A_Y];
      const s = view[o + A_SCALE] * 0.5;
      p.scaleX = s;
      p.scaleY = s;
      p.tint = bodyColour(view, o);
    } else {
      p.scaleX = 0;
      p.scaleY = 0;
    }
  }

  const foodCount = view[H_FOOD_COUNT] | 0;
  const base = foodOffset(count);
  ensureFood(foodCount);
  for (let i = 0; i < foodParticles.length; i++) {
    const p = foodParticles[i];
    if (i < foodCount) {
      const o = base + i * FOOD_STRIDE;
      const carrion = view[o + FOOD_TYPE] >= 1;
      p.x = view[o + FOOD_X];
      p.y = view[o + FOOD_Y];
      const s = carrion ? 1.2 : 0.8;
      p.scaleX = s;
      p.scaleY = s;
      p.tint = carrion ? CARRION_COLOUR : PLANT_COLOUR;
    } else {
      p.scaleX = 0;
      p.scaleY = 0;
    }
  }
  app.render();
  post();
}

/** Re-apply the camera and paint, without new agent data (pan/zoom/resize). The
 *  worker is push-driven, so camera moves must trigger their own render — the
 *  ticker is stopped and frames only arrive while the simulation is running. */
function redraw(): void {
  if (app === null) return;
  camera.applyTo(world);
  app.render();
}

/** Dense index of the live agent with stable id `id`, or -1. */
function findById(id: number): number {
  const view = lastView;
  if (view === null) return -1;
  for (let i = 0; i < lastCount; i++) {
    if ((view[HEADER_LENGTH + i * AGENT_STRIDE + A_ID] | 0) === id) return i;
  }
  return -1;
}

/** Select the creature nearest a screen point within the pick radius, or clear. */
function pickAt(sx: number, sy: number): void {
  const view = lastView;
  if (view === null) return;
  const wx = camera.screenToWorldX(sx);
  const wy = camera.screenToWorldY(sy);
  const r = PICK_RADIUS_PX / camera.scale;
  const r2 = r * r;
  let best = -1;
  let bestD2 = r2;
  for (let i = 0; i < lastCount; i++) {
    const o = HEADER_LENGTH + i * AGENT_STRIDE;
    const dx = view[o + A_X] - wx;
    const dy = view[o + A_Y] - wy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  selectedId = best === -1 ? -1 : view[HEADER_LENGTH + best * AGENT_STRIDE + A_ID] | 0;
  if (selectedId === -1) followId = -1;
}

/** Post the state the main thread mirrors: selection, viewport bounds. */
function post(): void {
  const b = camera.visibleBounds(viewW, viewH);
  (self as unknown as Worker).postMessage({ type: 'state', selectedId, bounds: b });
}

self.onmessage = (e: MessageEvent): void => {
  const m = e.data;
  switch (m.type) {
    case 'init':
      init(m).catch(() => (self as unknown as Worker).postMessage({ type: 'failed' }));
      break;
    case 'frame':
      frame(m.view as Float32Array, m.count as number);
      break;
    case 'resize':
      viewW = Math.max(1, m.width);
      viewH = Math.max(1, m.height);
      app?.renderer.resize(viewW, viewH);
      redraw();
      post();
      break;
    case 'pointerdown':
      pointerDown = true;
      dragged = false;
      lastPx = m.x;
      lastPy = m.y;
      downX = m.x;
      downY = m.y;
      break;
    case 'pointermove':
      if (pointerDown) {
        if (Math.abs(m.x - downX) > CLICK_SLOP || Math.abs(m.y - downY) > CLICK_SLOP) dragged = true;
        if (dragged) {
          camera.panBy(m.x - lastPx, m.y - lastPy);
          followId = -1;
          redraw();
        }
        lastPx = m.x;
        lastPy = m.y;
      }
      break;
    case 'pointerup':
      if (pointerDown && !dragged) pickAt(m.x, m.y);
      pointerDown = false;
      post();
      break;
    case 'wheel':
      camera.zoomAt(m.x, m.y, m.deltaY < 0 ? 1.1 : 1 / 1.1);
      redraw();
      post();
      break;
    case 'set':
      applySet(m.key, m.value);
      break;
  }
};

function applySet(key: string, value: unknown): void {
  switch (key) {
    case 'colourMode':
      colourMode = value as ColourMode;
      break;
    case 'palette':
      palette = PALETTES[value as number] ?? PALETTES[0];
      break;
    case 'following':
      if (value === false) followId = -1;
      else if (selectedId !== -1) followId = selectedId;
      break;
    case 'clearSelection':
      selectedId = -1;
      followId = -1;
      break;
    case 'centre': {
      const c = value as { x: number; y: number };
      camera.centreOn(c.x, c.y, viewW, viewH);
      redraw();
      post();
      break;
    }
  }
}
