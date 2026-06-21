import './style.css';
import { createSetupScreen } from './ui/setupScreen.ts';
import { createControls } from './ui/controls.ts';
import { createDock } from './ui/dock.ts';
import { createFeed } from './ui/feed.ts';
import { createInspector } from './ui/inspector.ts';
import { createRecordsPanel } from './ui/records.ts';
import { createCharts } from './ui/charts.ts';
import { createFamilyPanel } from './ui/family.ts';
import { createMinimap } from './ui/minimap.ts';
import { createLegend, createOnboarding } from './ui/legend.ts';
import { createNarratorPanel } from './ui/narratorPanel.ts';
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
  H_TRAIT_MEANS,
} from './core/snapshot.ts';
import { TRAIT_COUNT, DISPLAY } from './core/genome.ts';
import { NEAR_EXTINCTION_THRESHOLD } from './core/bounds.ts';
import { decodeParams, SHARE_HASH_PREFIX } from './core/share.ts';
import { encodePopulation, type PopulationRecord } from './core/population.ts';
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
  host.className = 'sim';
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
      // Init failed after the canvas was transferred to the worker; dispose it so
      // the orphaned canvas is removed before the main renderer adds its own.
      oc.dispose();
      surface = directorRenderer = await makeMainRenderer();
    }
  } else {
    surface = directorRenderer = await makeMainRenderer();
  }

  const feed = createFeed();

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
    feed.note('Offscreen renderer hit a snag — switched to the standard renderer.', 'milestone');
  };
  offscreen?.setErrorHandler(() => void swapToMain());

  const inspector = createInspector({ onAdopt: (on) => surface.setFollowing(on) });
  const records = createRecordsPanel();
  const charts = createCharts();
  const family = createFamilyPanel();
  const minimap = createMinimap(params.worldWidth, params.worldHeight, (x, y) =>
    surface.centreCameraOn(x, y),
  );
  const legend = createLegend();
  const onboarding = createOnboarding({ onOpenLegend: () => legend.toggle() });
  const narratorUI = createNarratorPanel();
  const dock = createDock();

  // Hall-of-fame + narrator-config popover, opened from the toolbar's 🏆 button.
  const statsPopover = document.createElement('div');
  statsPopover.className = 'popover stats-popover';
  statsPopover.append(records.element, narratorUI.element);

  // Live charts popover, opened from the toolbar's 📈 button.
  const chartsPopover = document.createElement('div');
  chartsPopover.className = 'popover charts-popover';
  chartsPopover.append(charts.element);

  // Family-tree popover, opened from the toolbar's 📜 button.
  const familyPopover = document.createElement('div');
  familyPopover.className = 'popover family-popover';
  familyPopover.append(family.element);
  let familyOpen = false;

  const milestones = new Milestones();
  const director = new Director(params.worldWidth, params.worldHeight);
  const sound = new SoundKit();
  const client = new SimulationClient();
  let frame = 0;
  let wasNearExtinction = false;
  let latestEvent: string | null = null;
  let inspectId = -1;

  // Assemble the single toolbar: the controls and the message log live inside it.
  dock.controlsHost.appendChild(
    createControls({
      client,
      min: params.minTimeMultiplier,
      max: params.maxTimeMultiplier,
      onReset: () => {
        client.dispose();
        showSetup();
      },
      directorEnabled: director.enabled,
      onToggleDirector: (on) => director.setEnabled(on),
      onLegend: () => legend.toggle(),
      onRecords: () => statsPopover.classList.toggle('open'),
      onCharts: () => charts.setOpen(chartsPopover.classList.toggle('open')),
      onFamily: () => {
        familyOpen = familyPopover.classList.toggle('open');
        if (familyOpen && inspectId !== -1) client.requestFamily(inspectId);
      },
      onOverlay: (mode) => {
        surface.setOverlayMode(mode);
        client.setOverlay(mode === 'pheromone');
      },
      onMinimap: () => minimap.element.classList.toggle('hidden'),
      onColourMode: (mode) => surface.setColourMode(mode),
      onExport: () => client.exportPopulation(),
      palettes: PALETTES.map((p) => p.name),
      onPalette: (index) => surface.setPalette(index),
      onQuality: (level) => surface.setQuality(level),
      reducedMotion: surface.isReducedMotion(),
      onReducedMotion: (on) => surface.setReducedMotion(on),
      soundEnabled: sound.isEnabled(),
      onToggleSound: (on) => sound.setEnabled(on),
    }),
  );
  dock.logHost.appendChild(feed.element);

  // The dock is in the layout flow (canvas fills the rest); the rest are overlays.
  mount.append(
    dock.element,
    statsPopover,
    chartsPopover,
    familyPopover,
    minimap.element,
    legend.element,
    onboarding.element,
    inspector.element,
  );
  // The dock now occupies part of the viewport, so the canvas host shrank — nudge
  // PixiJS (which only resizes on window events) to refit the canvas to it.
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));

  client.setFieldHandler((field, cols, rows, w, h) =>
    surface.setPheromoneField(field, cols, rows, w, h),
  );
  client.setFamilyHandler((f) => family.update(f));
  client.setPopulationHandler((save) => {
    const blob = new Blob([encodePopulation(save)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eek-a-volve-population-${save.tick}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  client.start(
    params,
    (view, count) => {
      surface.draw(view, count);

      // Mirror the renderer's selection to the worker so the inspector stays live.
      const selected = surface.getSelectedId();
      if (selected !== inspectId) {
        inspectId = selected;
        client.inspect(selected);
        if (selected === -1) inspector.hide();
        else inspector.show();
      }

      // The auto-director eases the camera to the most interesting subject. It
      // drives the main-thread camera directly, so it is active only on that path.
      if (directorRenderer !== null) director.update(view, count, performance.now(), directorRenderer);

      if (frame % 3 === 0) minimap.update(view, count, surface.getViewportBounds());

      // Sound, from the same real signals as the visual cues (no-ops when muted).
      if (sound.isEnabled()) {
        if (surface.getFrameAte() > 0) sound.eat();
        if (view[H_BIRTHS] > 0) sound.birth();
        if (view[H_DEATHS] > 0) sound.death();
      }

      const population = view[H_POPULATION];
      if (frame % 5 === 0) dock.updateStats(population, view[H_SPECIES_COUNT], view[H_TICK]);
      if (frame % 30 === 0) {
        charts.push({ tick: view[H_TICK], population, species: view[H_SPECIES_COUNT] });
        if (familyOpen && inspectId !== -1) client.requestFamily(inspectId);
      }

      const near = population > 0 && population <= NEAR_EXTINCTION_THRESHOLD;
      if (near && !wasNearExtinction) {
        feed.note(`Near extinction — only ${population} left!`, 'nearExtinction');
      }
      wasNearExtinction = near;

      if (frame % NARRATE_EVERY_FRAMES === 0) {
        const milestone = milestones.update({
          tick: view[H_TICK],
          population,
          speciesCount: view[H_SPECIES_COUNT],
          event: null,
        });
        if (milestone !== null) feed.note(milestone, 'milestone');
        const stats = {
          tick: view[H_TICK],
          population,
          births: view[H_BIRTHS],
          deaths: view[H_DEATHS],
          speciesCount: view[H_SPECIES_COUNT],
          traitMeans: view.subarray(H_TRAIT_MEANS, H_TRAIT_MEANS + TRAIT_COUNT),
          milestone,
          latestEvent,
          ornament: view[H_TRAIT_MEANS + DISPLAY],
          sexual: params.sexualReproduction,
          biomes: params.biomeStrength > 0,
          pheromones: params.pheromones,
        };
        dock.setNarration(narratorUI.narrator.narrate(stats, (line) => dock.setNarration(line)));
      }
      frame++;
    },
    (events) => {
      const line = feed.push(events);
      if (line !== null) latestEvent = line;
      director.ingest(events, performance.now());
      if (sound.isEnabled()) {
        for (const e of events) if (e.kind === 'catastrophe') sound.catastrophe();
      }
    },
    (detail) => {
      if (!detail.alive) {
        inspector.hide();
        surface.clearSelection();
        inspectId = -1;
      } else {
        inspector.update(detail);
      }
    },
    (view) => records.update(view),
    population,
  );
}

showSetup();
