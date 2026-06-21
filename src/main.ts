import './style.css';
import { createSetupScreen } from './ui/setupScreen.ts';
import { createToolbar } from './ui/toolbar.ts';
import { createWindowManager, type WinId } from './ui/windowManager.ts';
import { createStoryLog, type StoryEvent } from './ui/storyLog.ts';
import { createEventList, createEventDetail } from './ui/eventViews.ts';
import { createInspector } from './ui/inspector.ts';
import { createRecordsPanel } from './ui/records.ts';
import { createCharts } from './ui/charts.ts';
import { createFamilyPanel } from './ui/family.ts';
import { createMinimap } from './ui/minimap.ts';
import { createLegend } from './ui/legend.ts';
import { icon } from './ui/icons.ts';
import { Milestones } from './humour/milestones.ts';
import { SimulationClient } from './worker/client.ts';
import { Renderer, PALETTES } from './render/renderer.ts';
import type { RenderSurface } from './render/surface.ts';
import { OffscreenRenderClient, isOffscreenSupported } from './render/offscreenClient.ts';
import { Director } from './render/director.ts';
import { SoundKit } from './audio/sound.ts';
import {
  H_TICK,
  H_POPULATION,
  H_BIRTHS,
  H_DEATHS,
  H_SPECIES_COUNT,
  HEADER_LENGTH,
  AGENT_STRIDE,
  A_X,
  A_Y,
  A_ID,
} from './core/snapshot.ts';
import { NEAR_EXTINCTION_THRESHOLD } from './core/bounds.ts';
import { decodeParams, SHARE_HASH_PREFIX } from './core/share.ts';
import type { PopulationRecord } from './core/population.ts';
import type { SimulationParameters } from './core/params.ts';

const mount = document.querySelector<HTMLDivElement>('#app');
const NARRATE_EVERY_FRAMES = 150;

/** Decode a `#w=…` share link into parameters, or undefined when absent. */
function paramsFromHash(hash: string): SimulationParameters | undefined {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!body.startsWith(SHARE_HASH_PREFIX)) return undefined;
  return decodeParams(body.slice(SHARE_HASH_PREFIX.length));
}

function showSetup(): void {
  if (mount === null) return;
  mount.innerHTML = '';
  mount.appendChild(createSetupScreen(start, paramsFromHash(location.hash)));
}

function start(params: SimulationParameters, population?: PopulationRecord[]): void {
  if (mount === null) return;
  mount.innerHTML = '';
  const host = document.createElement('div');
  host.className = 'ev-stage';
  mount.appendChild(host);
  void run(params, host, population);
}

async function run(
  params: SimulationParameters,
  host: HTMLElement,
  population?: PopulationRecord[],
): Promise<void> {
  if (mount === null) return;

  // Default render path: the main-thread Renderer. The optional, experimental
  // OffscreenCanvas worker (params.offscreenRender) is tried only when supported,
  // and any init failure falls back here automatically (spec v0.4.2).
  const biome = { seed: params.seed, strength: params.biomeStrength };
  const makeMainRenderer = async (): Promise<Renderer> => {
    const r = new Renderer();
    await r.init(host, params.worldWidth, params.worldHeight, params.viewMode, biome);
    return r;
  };

  let surface: RenderSurface;
  let directorRenderer: Renderer | null = null;
  let offscreen: OffscreenRenderClient | null = null;
  if (params.offscreenRender && isOffscreenSupported()) {
    const oc = new OffscreenRenderClient();
    try {
      await oc.init(host, params.worldWidth, params.worldHeight, params.viewMode, 0, 'species');
      surface = oc;
      offscreen = oc;
    } catch {
      oc.dispose();
      surface = directorRenderer = await makeMainRenderer();
    }
  } else {
    surface = directorRenderer = await makeMainRenderer();
  }

  const storyLog = createStoryLog();

  // If the experimental offscreen worker fails after init, switch to the proven
  // main-thread renderer so the run continues unbroken.
  let swapping = false;
  const swapToMain = async (): Promise<void> => {
    if (swapping || directorRenderer !== null) return;
    swapping = true;
    offscreen?.dispose();
    offscreen = null;
    const r = await makeMainRenderer();
    surface = r;
    directorRenderer = r;
    storyLog.note('Offscreen renderer hit a snag — switched to the standard renderer.', 'milestone');
  };
  offscreen?.setErrorHandler(() => void swapToMain());

  const client = new SimulationClient();
  const milestones = new Milestones();
  const director = new Director(params.worldWidth, params.worldHeight);
  const sound = new SoundKit();

  let frame = 0;
  let wasNearExtinction = false;
  let inspectId = -1;
  /** The renderer's last-seen selection, so we only react when it *changes*
   *  (lets a Map tap drive the inspector without the loop overriding it). */
  let rendererSelectedId = -1;
  let latestGen = 0;
  let uiHidden = false;
  let hintTimer = 0;

  /** Inspect a creature by id (from a canvas tap or a Map tap): -1 clears it. */
  function setInspect(id: number): void {
    inspectId = id;
    client.inspect(id);
    if (id === -1) {
      if (wm.isOpen('inspector')) wm.close('inspector');
    } else if (!uiHidden) {
      hideHint();
      openWindow('inspector');
    }
  }

  // Reliable creature picking on the canvas, independent of the renderer's own
  // (touch-flaky) tap-to-select. Each frame we copy a compact [x, y, id] table
  // from the snapshot; a tap then resolves the nearest creature against it and
  // the camera viewport bounds. Using the cached table means a tap still works
  // while paused (the frozen positions are exactly what's on screen).
  let picks = new Float32Array(0);
  let pickCount = 0;
  let tapStartX = 0;
  let tapStartY = 0;
  let tapMoved = false;

  function rememberPicks(view: Float32Array, count: number): void {
    const need = count * 3;
    if (picks.length < need) picks = new Float32Array(need);
    for (let i = 0; i < count; i++) {
      const o = HEADER_LENGTH + i * AGENT_STRIDE;
      picks[i * 3] = view[o + A_X];
      picks[i * 3 + 1] = view[o + A_Y];
      picks[i * 3 + 2] = view[o + A_ID];
    }
    pickCount = count;
  }

  /** Inspect the nearest creature to a tapped screen point (forgiving for touch). */
  function pickCreatureAt(clientX: number, clientY: number): void {
    if (pickCount === 0 || uiHidden) return;
    const rect = host.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const vb = surface.getViewportBounds();
    const worldPerPxX = (vb.maxX - vb.minX) / rect.width;
    const worldPerPxY = (vb.maxY - vb.minY) / rect.height;
    const wx = vb.minX + (clientX - rect.left) * worldPerPxX;
    const wy = vb.minY + (clientY - rect.top) * worldPerPxY;
    let bestId = -1;
    let bestD = Infinity;
    for (let i = 0; i < pickCount; i++) {
      const dx = picks[i * 3] - wx;
      const dy = picks[i * 3 + 1] - wy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestId = picks[i * 3 + 2];
      }
    }
    const pickR = 30 * worldPerPxX; // accept within ~30px of a creature
    if (bestId >= 0 && bestD <= pickR * pickR) setInspect(bestId);
  }

  host.addEventListener('pointerdown', (e) => {
    tapStartX = e.clientX;
    tapStartY = e.clientY;
    tapMoved = false;
  });
  host.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - tapStartX) + Math.abs(e.clientY - tapStartY) > 10) tapMoved = true;
  });
  host.addEventListener('pointerup', (e) => {
    if (!tapMoved) pickCreatureAt(e.clientX, e.clientY);
  });

  // --- Window content bodies ---
  const inspector = createInspector({ onAdopt: (on) => surface.setFollowing(on) });
  const records = createRecordsPanel();
  const charts = createCharts();
  const family = createFamilyPanel();
  const minimap = createMinimap(
    params.worldWidth,
    params.worldHeight,
    (x, y) => surface.centreCameraOn(x, y),
    (id) => setInspect(id),
  );
  const legend = createLegend();
  const eventDetail = createEventDetail();
  const openDetail = (event: StoryEvent): void => {
    eventDetail.show(event);
    openWindow('detail');
  };
  const storyLogWindow = createEventList('full', openDetail);
  const renderStoryWindow = (): void => storyLogWindow.render(storyLog.getEvents());
  storyLog.onChange(renderStoryWindow);
  renderStoryWindow();

  // --- Window manager ---
  const wm = createWindowManager({
    bodies: {
      inspector: inspector.element,
      legend: legend.element,
      records: records.element,
      charts: charts.element,
      family: family.element,
      map: minimap.element,
      eventlog: storyLogWindow.element,
      detail: eventDetail.element,
    },
    onClose: (id) => {
      if (id === 'inspector') {
        surface.setFollowing(false);
        surface.clearSelection();
        inspector.reset();
        inspectId = -1;
      } else if (id === 'detail') {
        eventDetail.show(null);
      }
    },
    onResize: (id) => {
      if (id === 'charts') charts.resize();
      else if (id === 'map') minimap.resize();
    },
    onChange: () => {
      toolbar.refreshWindows();
      charts.setOpen(wm.isOpen('charts'));
      if (wm.isOpen('family') && inspectId !== -1) client.requestFamily(inspectId);
    },
  });

  /** Open a content window plus any per-window side effects. */
  function openWindow(id: WinId): void {
    wm.open(id);
    if (id === 'eventlog') renderStoryWindow();
    if (id === 'family' && inspectId !== -1) client.requestFamily(inspectId);
  }
  function toggleWindow(id: WinId): void {
    if (wm.isOpen(id)) wm.close(id);
    else openWindow(id);
  }

  // --- Toolbar (one-piece UI at the bottom: tabs + body + play/speed/stats) ---
  const toolbar = createToolbar({
    client,
    min: params.minTimeMultiplier,
    max: params.maxTimeMultiplier,
    storyLog,
    onOpenDetail: openDetail,
    onMaximiseLog: () => openWindow('eventlog'),
    onToggleWindow: toggleWindow,
    isWindowOpen: (id) => wm.isOpen(id),
    onCloseAll: () => wm.closeAll(),
    onHideUI: () => hideUI(),
    onReset: () => requestReset(),
    director: director.enabled,
    onDirector: (on) => director.setEnabled(on),
    sound: sound.isEnabled(),
    onSound: (on) => sound.setEnabled(on),
    calm: surface.isReducedMotion(),
    onCalm: (on) => surface.setReducedMotion(on),
    palettes: PALETTES.map((p) => p.name),
    onPalette: (index) => surface.setPalette(index),
    quality: 'medium',
    onQuality: (level) => surface.setQuality(level),
  });

  // --- First-run hint ("tap a critter to meet it") ---
  const hint = document.createElement('div');
  hint.className = 'ev-hint';
  hint.textContent = '👆 tap a critter to meet it';
  const hideHint = (): void => {
    hint.style.display = 'none';
    if (hintTimer !== 0) window.clearTimeout(hintTimer);
    hintTimer = 0;
  };
  hintTimer = window.setTimeout(hideHint, 7000);

  // --- HUD layer (pointer-events: none; interactive children re-enable) ---
  const hud = document.createElement('div');
  hud.className = 'ev-hud';
  hud.append(hint, wm.element, toolbar.element);

  // --- Show-UI button (visible only while the HUD is hidden) ---
  const showUIBtn = document.createElement('button');
  showUIBtn.type = 'button';
  showUIBtn.className = 'ev-show-ui';
  showUIBtn.title = 'Show interface';
  showUIBtn.setAttribute('aria-label', 'Show interface');
  showUIBtn.appendChild(icon('eye', 20));
  showUIBtn.style.display = 'none';
  showUIBtn.addEventListener('click', () => showUI());

  function hideUI(): void {
    uiHidden = true;
    hud.style.display = 'none';
    showUIBtn.style.display = '';
    // Toolbar height now measures 0, so the world (stage) reclaims the screen.
    window.dispatchEvent(new Event('resize'));
  }
  function showUI(): void {
    uiHidden = false;
    hud.style.display = '';
    showUIBtn.style.display = 'none';
    window.dispatchEvent(new Event('resize'));
    if (inspectId !== -1) openWindow('inspector');
  }

  // --- Reset confirmation modal ---
  const modal = document.createElement('div');
  modal.className = 'ev-modal';
  modal.style.display = 'none';
  const modalCard = document.createElement('div');
  modalCard.className = 'ev-modal-card';
  modalCard.innerHTML =
    '<div class="ev-modal-title">Reset the world?</div>' +
    '<p class="ev-modal-body">This ends the current run and returns to setup. Every creature, lineage and record so far will be lost. Are you sure?</p>';
  const modalButtons = document.createElement('div');
  modalButtons.className = 'ev-modal-buttons';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ev-modal-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'ev-modal-confirm';
  confirmBtn.textContent = 'Yes, reset';
  confirmBtn.addEventListener('click', () => {
    client.dispose();
    showSetup();
  });
  modalButtons.append(cancelBtn, confirmBtn);
  modalCard.appendChild(modalButtons);
  modal.appendChild(modalCard);
  function requestReset(): void {
    modal.style.display = '';
  }

  mount.append(hud, showUIBtn, modal);

  // The windows tile the "world" — the area above the toolbar — so re-tile from
  // the toolbar's measured height whenever it (or the viewport) changes, and
  // publish that height to CSS so the hint sits just above the toolbar.
  const relayout = (): void => {
    const h = toolbar.element.offsetHeight;
    document.documentElement.style.setProperty('--toolbar-h', `${h}px`);
    wm.relayout(h);
  };
  relayout();
  window.addEventListener('resize', relayout);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(relayout).observe(toolbar.element);
  }
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));

  // --- Worker handlers ---
  client.setFieldHandler((field, cols, rows, w, h) =>
    surface.setPheromoneField(field, cols, rows, w, h),
  );
  client.setFamilyHandler((f) => family.update(f));

  client.start(
    params,
    (view, count) => {
      surface.draw(view, count);

      // A canvas tap changes the renderer's selection; react to that change and
      // drive the inspector. (Our own pick below also handles taps directly.)
      const selected = surface.getSelectedId();
      if (selected !== rendererSelectedId) {
        rendererSelectedId = selected;
        setInspect(selected);
      }
      // Keep the compact pick table fresh so canvas taps resolve reliably.
      rememberPicks(view, count);

      // The auto-director eases the camera to the most interesting subject. It
      // drives the main-thread camera directly, so it is active only on that path.
      if (directorRenderer !== null) director.update(view, count, performance.now(), directorRenderer);

      if (wm.isOpen('map') && frame % 3 === 0) {
        minimap.update(view, count, surface.getViewportBounds());
      }

      // Sound, from the same real signals as the visual cues (no-ops when muted).
      if (sound.isEnabled()) {
        if (surface.getFrameAte() > 0) sound.eat();
        if (view[H_BIRTHS] > 0) sound.birth();
        if (view[H_DEATHS] > 0) sound.death();
      }

      const population = view[H_POPULATION];
      const tick = view[H_TICK];
      if (frame % 5 === 0) {
        storyLog.setContext(tick, latestGen);
        toolbar.updateStats(latestGen, population, view[H_SPECIES_COUNT], tick);
      }
      if (frame % 30 === 0) {
        charts.push({ tick, population, species: view[H_SPECIES_COUNT] });
        if (wm.isOpen('family') && inspectId !== -1) client.requestFamily(inspectId);
      }

      const near = population > 0 && population <= NEAR_EXTINCTION_THRESHOLD;
      if (near && !wasNearExtinction) {
        storyLog.note(`Near extinction — only ${population} left!`, 'catastrophe');
      }
      wasNearExtinction = near;

      if (frame % NARRATE_EVERY_FRAMES === 0) {
        const milestone = milestones.update({
          tick,
          population,
          speciesCount: view[H_SPECIES_COUNT],
          event: null,
        });
        if (milestone !== null) storyLog.note(milestone, 'milestone');
      }
      frame++;
    },
    (events) => {
      storyLog.push(events);
      director.ingest(events, performance.now());
      if (sound.isEnabled()) {
        for (const e of events) if (e.kind === 'catastrophe') sound.catastrophe();
      }
    },
    (detail) => {
      if (!detail.alive) {
        // The adopted creature died: drop the window and clear the renderer
        // selection so getSelectedId stops returning a dead id (no reopen loop).
        if (wm.isOpen('inspector')) wm.close('inspector');
        surface.clearSelection();
        inspectId = -1;
      } else {
        inspector.update(detail);
      }
    },
    (view) => {
      records.update(view);
      latestGen = view.longestBloodline.value;
    },
    population,
  );
}

showSetup();
