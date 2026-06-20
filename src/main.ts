import './style.css';
import { createSetupScreen } from './ui/setupScreen.ts';
import { createControls } from './ui/controls.ts';
import { createDock } from './ui/dock.ts';
import { createFeed } from './ui/feed.ts';
import { createInspector } from './ui/inspector.ts';
import { createRecordsPanel } from './ui/records.ts';
import { createLegend, createOnboarding } from './ui/legend.ts';
import { createNarratorPanel } from './ui/narratorPanel.ts';
import { Milestones } from './humour/milestones.ts';
import { SimulationClient } from './worker/client.ts';
import { Renderer, PALETTES } from './render/renderer.ts';
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
import { TRAIT_COUNT } from './core/genome.ts';
import { NEAR_EXTINCTION_THRESHOLD } from './core/bounds.ts';
import { decodeParams, SHARE_HASH_PREFIX } from './core/share.ts';
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

function start(params: SimulationParameters): void {
  if (mount === null) return;
  mount.innerHTML = '';
  const host = document.createElement('div');
  host.className = 'sim';
  mount.appendChild(host);
  void run(params, host);
}

async function run(params: SimulationParameters, host: HTMLElement): Promise<void> {
  if (mount === null) return;
  const renderer = new Renderer();
  await renderer.init(host, params.worldWidth, params.worldHeight, params.viewMode, {
    seed: params.seed,
    strength: params.biomeStrength,
  });

  const feed = createFeed();
  const inspector = createInspector({ onAdopt: (on) => renderer.setFollowing(on) });
  const records = createRecordsPanel();
  const legend = createLegend();
  const onboarding = createOnboarding({ onOpenLegend: () => legend.toggle() });
  const narratorUI = createNarratorPanel();
  const dock = createDock();

  // Hall-of-fame + narrator-config popover, opened from the toolbar's 🏆 button.
  const statsPopover = document.createElement('div');
  statsPopover.className = 'popover stats-popover';
  statsPopover.append(records.element, narratorUI.element);

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
      palettes: PALETTES.map((p) => p.name),
      onPalette: (index) => renderer.setPalette(index),
      onQuality: (level) => renderer.setQuality(level),
      reducedMotion: renderer.isReducedMotion(),
      onReducedMotion: (on) => renderer.setReducedMotion(on),
      soundEnabled: sound.isEnabled(),
      onToggleSound: (on) => sound.setEnabled(on),
    }),
  );
  dock.logHost.appendChild(feed.element);

  // The dock is in the layout flow (canvas fills the rest); the rest are overlays.
  mount.append(dock.element, statsPopover, legend.element, onboarding.element, inspector.element);
  // The dock now occupies part of the viewport, so the canvas host shrank — nudge
  // PixiJS (which only resizes on window events) to refit the canvas to it.
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));

  client.start(
    params,
    (view, count) => {
      renderer.draw(view, count);

      // Mirror the renderer's selection to the worker so the inspector stays live.
      const selected = renderer.getSelectedId();
      if (selected !== inspectId) {
        inspectId = selected;
        client.inspect(selected);
        if (selected === -1) inspector.hide();
        else inspector.show();
      }

      // The auto-director eases the camera to the most interesting subject.
      director.update(view, count, performance.now(), renderer);

      // Sound, from the same real signals as the visual cues (no-ops when muted).
      if (sound.isEnabled()) {
        if (renderer.getFrameAte() > 0) sound.eat();
        if (view[H_BIRTHS] > 0) sound.birth();
        if (view[H_DEATHS] > 0) sound.death();
      }

      const population = view[H_POPULATION];
      if (frame % 5 === 0) dock.updateStats(population, view[H_SPECIES_COUNT], view[H_TICK]);

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
        renderer.clearSelection();
        inspectId = -1;
      } else {
        inspector.update(detail);
      }
    },
    (view) => records.update(view),
  );
}

showSetup();
