import './style.css';
import { createSetupScreen } from './ui/setupScreen.ts';
import { createControlBar } from './ui/controls.ts';
import { createToolbarWindow } from './ui/toolbarWindow.ts';
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
import { MOBILE_BREAKPOINT } from './ui/layout.ts';
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
  let latestGen = 0;
  let uiHidden = false;
  let hintTimer = 0;

  // --- Window content bodies ---
  const inspector = createInspector({ onAdopt: (on) => surface.setFollowing(on) });
  const records = createRecordsPanel();
  const charts = createCharts();
  const family = createFamilyPanel();
  const minimap = createMinimap(params.worldWidth, params.worldHeight, (x, y) =>
    surface.centreCameraOn(x, y),
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

  // --- Toolbar ("message") window ---
  const toolbar = createToolbarWindow({
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

  // --- Control bar ---
  const controlBar = createControlBar({
    client,
    min: params.minTimeMultiplier,
    max: params.maxTimeMultiplier,
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
  hud.append(hint, wm.element, toolbar.element, controlBar);

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
  }
  function showUI(): void {
    uiHidden = false;
    hud.style.display = '';
    showUIBtn.style.display = 'none';
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

  // The HUD floats over a full-bleed canvas; nudge PixiJS (which only resizes on
  // window events) to refit, and tile the windows for the current orientation.
  const relayout = (): void => wm.relayout(window.innerWidth < MOBILE_BREAKPOINT);
  relayout();
  window.addEventListener('resize', relayout);
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

      // Mirror the renderer's selection to the worker so the inspector stays live.
      const selected = surface.getSelectedId();
      if (selected !== inspectId) {
        inspectId = selected;
        client.inspect(selected);
        if (selected === -1) {
          if (wm.isOpen('inspector')) wm.close('inspector');
        } else if (!uiHidden) {
          hideHint();
          openWindow('inspector');
        }
      }

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
