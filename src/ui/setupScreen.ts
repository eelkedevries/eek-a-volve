import {
  DEFAULT_PARAMETERS,
  COMMUNITY_PRESET,
  SWARM_PRESET,
  type SimulationParameters,
} from '../core/params.ts';
import { encodeParams, SHARE_HASH_PREFIX } from '../core/share.ts';
import { decodePopulation, type PopulationRecord } from '../core/population.ts';
import { icon, type IconName } from './icons.ts';

type Key = keyof SimulationParameters;

interface SliderDef {
  label: string;
  min: number;
  max: number;
  step: number;
  /** Decimal places for the value/min/max captions (integers when absent). */
  dec?: number;
}

/** The three headline dials (design: "Three core sliders"). */
const CORE: Partial<Record<Key, SliderDef>> = {
  initialPopulation: { label: 'Population', min: 10, max: 2000, step: 10 },
  foodAbundance: { label: 'Food', min: 50, max: 2000, step: 10 },
  mutationRate: { label: 'Mutation', min: 0, max: 1, step: 0.01, dec: 2 },
};

/** The four behaviour chips (design: "Four behavior chips"). */
const CHIPS: { key: Key; label: string; icon: IconName }[] = [
  { key: 'predation', label: 'Predation', icon: 'predation' },
  { key: 'catastrophes', label: 'Catastrophes', icon: 'catastrophe' },
  { key: 'immigration', label: 'Immigration', icon: 'immigration' },
  { key: 'sexualReproduction', label: 'Sexual repro', icon: 'sexual' },
];

/** Advanced disclosure tabs and the parameter rows under each (design: ranges). */
const ADV_TABS: { id: string; label: string; rows: Key[] }[] = [
  { id: 'population', label: 'Population', rows: ['startingSpeciesCount', 'startingEnergy', 'reproductionThreshold', 'baseMetabolicCost', 'maxPopulation'] },
  { id: 'food', label: 'Food', rows: ['foodRegenRate', 'biomeStrength', 'seasonAmplitude', 'seasonPeriod'] },
  { id: 'mutation', label: 'Mutation', rows: ['mutationMagnitude'] },
  { id: 'pheromones', label: 'Pheromones', rows: ['pheromones', 'pheromoneCellSize', 'pheromoneDecay', 'pheromoneDiffusion', 'pheromoneDeposit'] },
  { id: 'world', label: 'World', rows: ['worldWidth', 'worldHeight', 'seed'] },
  { id: 'behaviour', label: 'Behaviour', rows: ['predation', 'catastrophes', 'immigration', 'sexualReproduction'] },
  { id: 'engine', label: 'Engine', rows: ['neuralBrains', 'offscreenRender', 'wasmCore'] },
];

/** Per-row metadata: a bounded slider def, or a boolean toggle. */
const ROWDEF: Partial<Record<Key, SliderDef | { toggle: true; label: string }>> = {
  startingSpeciesCount: { label: 'Starting species', min: 1, max: 12, step: 1 },
  startingEnergy: { label: 'Starting energy', min: 10, max: 150, step: 5 },
  reproductionThreshold: { label: 'Reproduction threshold', min: 20, max: 200, step: 5 },
  baseMetabolicCost: { label: 'Base metabolic cost', min: 0, max: 1, step: 0.01, dec: 2 },
  maxPopulation: { label: 'Max population', min: 200, max: 5000, step: 100 },
  foodRegenRate: { label: 'Food regen rate', min: 0, max: 50, step: 1 },
  biomeStrength: { label: 'Biome strength', min: 0, max: 1, step: 0.05, dec: 2 },
  seasonAmplitude: { label: 'Season amplitude', min: 0, max: 1, step: 0.05, dec: 2 },
  seasonPeriod: { label: 'Season period', min: 200, max: 4000, step: 100 },
  mutationMagnitude: { label: 'Mutation magnitude', min: 0, max: 1, step: 0.01, dec: 2 },
  pheromones: { toggle: true, label: 'Pheromones' },
  pheromoneCellSize: { label: 'Pheromone cell size', min: 4, max: 64, step: 2 },
  pheromoneDecay: { label: 'Pheromone decay', min: 0, max: 1, step: 0.01, dec: 2 },
  pheromoneDiffusion: { label: 'Pheromone diffusion', min: 0, max: 1, step: 0.01, dec: 2 },
  pheromoneDeposit: { label: 'Pheromone deposit', min: 0, max: 20, step: 0.5, dec: 1 },
  worldWidth: { label: 'World width', min: 200, max: 2000, step: 20 },
  worldHeight: { label: 'World height', min: 200, max: 2000, step: 20 },
  seed: { label: 'Seed', min: 1, max: 9999, step: 1 },
  predation: { toggle: true, label: 'Predation' },
  catastrophes: { toggle: true, label: 'Catastrophes' },
  immigration: { toggle: true, label: 'Immigration' },
  sexualReproduction: { toggle: true, label: 'Sexual reproduction' },
  neuralBrains: { toggle: true, label: 'Neural brains' },
  offscreenRender: { toggle: true, label: 'Offscreen render' },
  wasmCore: { toggle: true, label: 'WASM core' },
};

type ViewMode = SimulationParameters['viewMode'];

const PRESETS: Record<ViewMode, { partial: Partial<SimulationParameters>; accent: string; icon: IconName; title: string; desc: string }> = {
  community: {
    partial: COMMUNITY_PRESET,
    accent: '#5cff8f',
    icon: 'community',
    title: 'Community',
    desc: 'Small & cosy. A handful of creatures, courtship you can follow.',
  },
  swarm: {
    partial: SWARM_PRESET,
    accent: '#54d6ff',
    icon: 'swarm',
    title: 'Swarm',
    desc: 'Big & chaotic. Hundreds at once, selection at scale.',
  },
};

function isToggleDef(def: SliderDef | { toggle: true; label: string }): def is { toggle: true; label: string } {
  return 'toggle' in def;
}

function format(def: SliderDef, value: number): string {
  return def.dec != null ? value.toFixed(def.dec) : String(value);
}

/**
 * The pre-start setup screen (design: "Screen 1 — Setup"). A centred card: pick a
 * world preset, nudge the three core dials, flip the four behaviour chips, and
 * optionally open the tabbed "advanced soup chemistry" panel — all bound to the
 * real {@link SimulationParameters}. Selecting a preset rewrites the world to that
 * mode's preset. On submit it hands the parameters to `onStart`.
 */
export function createSetupScreen(
  onStart: (params: SimulationParameters, population?: PopulationRecord[]) => void,
  initial?: SimulationParameters,
): HTMLElement {
  const params: SimulationParameters = { ...DEFAULT_PARAMETERS, ...(initial ?? {}) };
  const refreshers: (() => void)[] = [];

  const overlay = document.createElement('div');
  overlay.className = 'ev-setup-overlay';
  const card = document.createElement('div');
  card.className = 'ev-setup-card ev-scroll';
  overlay.appendChild(card);

  // --- Title + subtitle ---
  const head = document.createElement('div');
  head.className = 'ev-setup-head';
  const title = document.createElement('div');
  title.className = 'ev-setup-title';
  title.textContent = 'eek‑a‑volve';
  const subtitle = document.createElement('p');
  subtitle.className = 'ev-setup-subtitle';
  subtitle.textContent =
    'A tiny world of made‑up creatures that live, eat, breed and die. Pick a world, nudge a couple of dials, press go.';
  head.append(title, subtitle);
  card.appendChild(head);

  // --- Preset cards ---
  const modes = document.createElement('div');
  modes.className = 'ev-setup-modes';
  const modeButtons = new Map<ViewMode, HTMLButtonElement>();
  for (const mode of ['community', 'swarm'] as ViewMode[]) {
    const meta = PRESETS[mode];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ev-mode ev-mode-${mode}`;
    const titleRow = document.createElement('div');
    titleRow.className = 'ev-mode-title';
    const glyph = icon(meta.icon, 20);
    glyph.style.color = meta.accent;
    titleRow.append(glyph, document.createTextNode(meta.title));
    const desc = document.createElement('div');
    desc.className = 'ev-mode-desc';
    desc.textContent = meta.desc;
    button.append(titleRow, desc);
    button.addEventListener('click', () => applyPreset(mode));
    modes.appendChild(button);
    modeButtons.set(mode, button);
  }
  card.appendChild(modes);

  // --- Core sliders ---
  const coreWrap = document.createElement('div');
  coreWrap.className = 'ev-core';
  for (const [key, def] of Object.entries(CORE) as [Key, SliderDef][]) {
    coreWrap.appendChild(buildCoreSlider(key, def));
  }
  card.appendChild(coreWrap);

  // --- Behaviour chips ---
  const chipWrap = document.createElement('div');
  chipWrap.className = 'ev-chips';
  for (const chip of CHIPS) chipWrap.appendChild(buildChip(chip.key, chip.icon, chip.label));
  card.appendChild(chipWrap);

  // --- Advanced disclosure ---
  let advTab = ADV_TABS[0].id;
  let advOpen = false;
  const advToggle = document.createElement('button');
  advToggle.type = 'button';
  advToggle.className = 'ev-adv-toggle';
  const advCaret = document.createElement('span');
  advCaret.className = 'ev-adv-caret';
  advCaret.textContent = '▸';
  const advLabel = document.createElement('span');
  advLabel.textContent = 'Advanced soup chemistry';
  advToggle.append(advCaret, advLabel);
  const advPanel = document.createElement('div');
  advPanel.className = 'ev-adv-panel';
  advPanel.style.display = 'none';
  const advStrip = document.createElement('div');
  advStrip.className = 'ev-adv-strip ev-scroll-x';
  const advContent = document.createElement('div');
  advContent.className = 'ev-adv-content';
  advPanel.append(advStrip, advContent);

  const tabButtons = new Map<string, HTMLButtonElement>();
  for (const tab of ADV_TABS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ev-adv-tab';
    button.textContent = tab.label;
    button.addEventListener('click', () => {
      advTab = tab.id;
      renderAdvContent();
    });
    advStrip.appendChild(button);
    tabButtons.set(tab.id, button);
  }

  function renderAdvContent(): void {
    for (const [id, button] of tabButtons) button.classList.toggle('is-active', id === advTab);
    advContent.replaceChildren();
    const tab = ADV_TABS.find((t) => t.id === advTab) ?? ADV_TABS[0];
    for (const key of tab.rows) {
      const def = ROWDEF[key];
      if (def === undefined) continue;
      advContent.appendChild(isToggleDef(def) ? buildToggleRow(key, def.label) : buildAdvSlider(key, def));
    }
  }

  advToggle.addEventListener('click', () => {
    advOpen = !advOpen;
    advPanel.style.display = advOpen ? '' : 'none';
    advCaret.classList.toggle('is-open', advOpen);
    advLabel.textContent = advOpen ? 'Hide advanced' : 'Advanced soup chemistry';
    if (advOpen) renderAdvContent();
  });
  card.append(advToggle, advPanel);

  // --- Primary CTA ---
  const start = document.createElement('button');
  start.type = 'button';
  start.className = 'ev-cta';
  start.innerHTML = 'Breathe life into it&nbsp;&nbsp;→';
  start.addEventListener('click', () => onStart({ ...params }));
  card.appendChild(start);

  // --- Secondary: share link + resume from a saved population ---
  const footer = document.createElement('div');
  footer.className = 'ev-setup-footer';
  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'ev-setup-link';
  share.textContent = 'Copy share link';
  share.addEventListener('click', () => {
    const hash = `${SHARE_HASH_PREFIX}${encodeParams({ ...params })}`;
    const url = `${location.origin}${location.pathname}${location.search}#${hash}`;
    const reset = (): void => {
      window.setTimeout(() => {
        share.textContent = 'Copy share link';
      }, 1600);
    };
    if (navigator.clipboard?.writeText !== undefined) {
      navigator.clipboard.writeText(url).then(
        () => {
          share.textContent = 'Link copied ✓';
          reset();
        },
        () => {
          location.hash = hash;
          share.textContent = 'Link in address bar';
          reset();
        },
      );
    } else {
      location.hash = hash;
      share.textContent = 'Link in address bar';
      reset();
    }
  });
  const importLabel = document.createElement('label');
  importLabel.className = 'ev-setup-link ev-setup-import';
  importLabel.textContent = 'Resume a saved population';
  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (file === undefined) return;
    void file.text().then((text) => {
      const save = decodePopulation(text);
      onStart(save.params, save.creatures);
    });
  });
  importLabel.appendChild(importInput);
  footer.append(share, importLabel);
  card.appendChild(footer);

  // --- Builders (closures over `params` + `refreshers`) ---
  function buildCoreSlider(key: Key, def: SliderDef): HTMLElement {
    const rowEl = document.createElement('div');
    rowEl.className = 'ev-core-row';
    const label = document.createElement('span');
    label.className = 'ev-core-label';
    label.textContent = def.label;
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'ev-range';
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.setAttribute('aria-label', def.label);
    const value = document.createElement('span');
    value.className = 'ev-core-value';
    const sync = (): void => {
      input.value = String(params[key]);
      value.textContent = format(def, params[key] as number);
    };
    input.addEventListener('input', () => {
      (params[key] as number) = def.dec != null ? parseFloat(input.value) : parseInt(input.value, 10);
      value.textContent = format(def, params[key] as number);
    });
    sync();
    refreshers.push(sync);
    rowEl.append(label, input, value);
    return rowEl;
  }

  function buildChip(key: Key, iconName: IconName, label: string): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ev-chip';
    button.append(icon(iconName, 20), document.createTextNode(label));
    const sync = (): void => {
      const on = Boolean(params[key]);
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-pressed', String(on));
    };
    button.addEventListener('click', () => {
      (params[key] as boolean) = !params[key];
      sync();
    });
    sync();
    refreshers.push(sync);
    return button;
  }

  function buildAdvSlider(key: Key, def: SliderDef): HTMLElement {
    const rowEl = document.createElement('div');
    rowEl.className = 'ev-adv-row';
    const top = document.createElement('div');
    top.className = 'ev-adv-row-top';
    const label = document.createElement('span');
    label.className = 'ev-adv-row-label';
    label.textContent = def.label;
    const value = document.createElement('span');
    value.className = 'ev-adv-row-value';
    top.append(label, value);
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'ev-range';
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.setAttribute('aria-label', def.label);
    const caps = document.createElement('div');
    caps.className = 'ev-adv-row-caps';
    const minCap = document.createElement('span');
    minCap.textContent = format(def, def.min);
    const maxCap = document.createElement('span');
    maxCap.textContent = format(def, def.max);
    caps.append(minCap, maxCap);
    input.value = String(params[key]);
    value.textContent = format(def, params[key] as number);
    input.addEventListener('input', () => {
      (params[key] as number) = def.dec != null ? parseFloat(input.value) : parseInt(input.value, 10);
      value.textContent = format(def, params[key] as number);
    });
    rowEl.append(top, input, caps);
    return rowEl;
  }

  function buildToggleRow(key: Key, label: string): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ev-toggle-row';
    const text = document.createElement('span');
    text.textContent = label;
    const track = document.createElement('span');
    track.className = 'ev-switch';
    const knob = document.createElement('span');
    knob.className = 'ev-switch-knob';
    track.appendChild(knob);
    button.append(text, track);
    const sync = (): void => {
      const on = Boolean(params[key]);
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', String(on));
    };
    button.addEventListener('click', () => {
      (params[key] as boolean) = !params[key];
      sync();
      // Behaviour toggles double as chips — keep the chips in step.
      for (const r of refreshers) r();
    });
    sync();
    return button;
  }

  // --- Preset application ---
  function applyPreset(mode: ViewMode): void {
    Object.assign(params, PRESETS[mode].partial);
    params.viewMode = mode;
    for (const [m, button] of modeButtons) button.classList.toggle('is-selected', m === mode);
    for (const r of refreshers) r();
    if (advOpen) renderAdvContent();
  }

  // A shared link seeds exact numbers (highlight only); a fresh form applies the
  // default mode's preset so the world and the cards start consistent.
  if (initial !== undefined) {
    for (const [m, button] of modeButtons) button.classList.toggle('is-selected', m === initial.viewMode);
  } else {
    applyPreset(DEFAULT_PARAMETERS.viewMode);
  }

  return overlay;
}
