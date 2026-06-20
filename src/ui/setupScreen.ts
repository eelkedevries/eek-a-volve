import {
  DEFAULT_PARAMETERS,
  COMMUNITY_PRESET,
  SWARM_PRESET,
  type SimulationParameters,
} from '../core/params.ts';
import { encodeParams, SHARE_HASH_PREFIX } from '../core/share.ts';
import { decodePopulation, type PopulationRecord } from '../core/population.ts';

/** Concise, plain-English help for each pre-start parameter. */
const HELP: Record<string, string> = {
  worldWidth: 'Width of the world, in simulation units. Bigger worlds spread the population thinner.',
  worldHeight: 'Height of the world, in simulation units.',
  seed: 'Random seed. The same seed and parameters reproduce a run exactly.',
  initialPopulation: 'How many creatures the world starts with.',
  startingSpeciesCount: 'How many distinct genetic clusters the founders are split into.',
  foodAbundance: 'Food carrying capacity — the main control on how large the population can grow.',
  foodRegenRate: 'How quickly eaten food is replaced each tick, up to the carrying capacity.',
  startingEnergy: 'Energy each founder begins with.',
  baseMetabolicCost: 'Baseline energy drained per tick before trait scaling. Higher means hungrier creatures.',
  reproductionThreshold: 'Energy a creature must reach before it can reproduce.',
  mutationRate: 'Chance (0–1) that each trait mutates in an offspring.',
  mutationMagnitude: 'How large a mutation step is when a trait does mutate.',
  predation: 'Whether larger, carnivorous creatures may eat smaller ones.',
  catastrophes: 'Whether occasional disasters (meteors, plagues, droughts) can strike.',
  immigration: 'Whether a trickle of fresh-genome newcomers arrives over time.',
  sexualReproduction: 'Two parents and genome crossover (on), or single-parent budding (off). Enables sexual selection.',
  viewMode: 'Community: a small, cosy pond. Swarm: a vast, chaotic ocean.',
  pheromones: 'Whether creatures lay and follow scent trails toward food (stigmergy).',
  pheromoneCellSize: 'Resolution of the scent-trail grid, in world units. Smaller is finer.',
  pheromoneDecay: 'How fast trails fade each tick (0–1). Lower fades faster.',
  pheromoneDiffusion: 'How much trails spread to neighbouring cells each tick (0–1).',
  pheromoneDeposit: 'How much scent a creature drops when it eats.',
  biomeStrength: 'How strongly food clusters into fertile regions (0 = spread evenly).',
  minTimeMultiplier: 'Slowest post-start speed (ticks per frame).',
  maxTimeMultiplier: 'Fastest post-start speed (ticks per frame).',
};

/** Turn a camelCase parameter key into a British-English label. */
function humanise(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

type ViewMode = SimulationParameters['viewMode'];
const VIEW_MODES: readonly ViewMode[] = ['community', 'swarm'];

/** The population/world preset bundled with each view mode. */
function presetFor(mode: ViewMode): Partial<SimulationParameters> {
  return mode === 'swarm' ? SWARM_PRESET : COMMUNITY_PRESET;
}

/** Short, characterful blurbs for the two world presets. */
const MODE_BLURBS: Record<ViewMode, { emoji: string; title: string; desc: string }> = {
  community: {
    emoji: '🫧',
    title: 'Community',
    desc: 'Small, cosy pond. Sexual reproduction — courtship you can actually follow.',
  },
  swarm: {
    emoji: '🌊',
    title: 'Swarm',
    desc: 'A big chaotic ocean of asexual cloners. Boom, bust, repeat at scale.',
  },
};

/**
 * Build the pre-start setup screen: a form over the whole `SimulationParameters`
 * object (number inputs, checkboxes, and the view-mode select), seeded from the
 * defaults. Two large preset cards (Community / Swarm) sit above the form and
 * rescale the world by applying that mode's preset; the view-mode select stays in
 * sync. On submit it reads the values and calls `onStart` (specification: Scope —
 * parameters are configured before starting only).
 */
export function createSetupScreen(
  onStart: (params: SimulationParameters, population?: PopulationRecord[]) => void,
  initial?: SimulationParameters,
): HTMLElement {
  const seed = initial ?? DEFAULT_PARAMETERS;
  const screen = document.createElement('div');
  screen.className = 'setup-screen';

  const title = document.createElement('h1');
  title.textContent = 'eek-a-volve';
  screen.appendChild(title);

  const blurb = document.createElement('p');
  blurb.textContent =
    'Tune the soup, then breathe life into it. Afterwards only speed and pause change.';
  screen.appendChild(blurb);

  // --- Preset cards (pick a world, the form rescales to match) ---
  const modes = document.createElement('div');
  modes.className = 'setup-modes';
  const modeButtons = new Map<ViewMode, HTMLButtonElement>();
  for (const mode of VIEW_MODES) {
    const meta = MODE_BLURBS[mode];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'setup-mode';
    card.setAttribute('aria-pressed', 'false');
    const t = document.createElement('div');
    t.className = 'setup-mode-title';
    t.textContent = `${meta.emoji} ${meta.title}`;
    const d = document.createElement('div');
    d.className = 'setup-mode-desc';
    d.textContent = meta.desc;
    card.append(t, d);
    card.addEventListener('click', () => selectMode(mode));
    modes.appendChild(card);
    modeButtons.set(mode, card);
  }
  screen.appendChild(modes);

  const form = document.createElement('form');
  form.className = 'setup-form';
  const controls = new Map<string, HTMLInputElement | HTMLSelectElement>();
  let viewModeSelect: HTMLSelectElement | undefined;

  for (const [key, value] of Object.entries(seed)) {
    const label = document.createElement('label');
    label.textContent = humanise(key);
    let control: HTMLInputElement | HTMLSelectElement;
    if (key === 'viewMode') {
      const select = document.createElement('select');
      for (const mode of VIEW_MODES) {
        const option = document.createElement('option');
        option.value = mode;
        option.textContent = humanise(mode);
        select.appendChild(option);
      }
      select.value = String(value);
      select.addEventListener('change', () => selectMode(select.value as ViewMode));
      viewModeSelect = select;
      control = select;
    } else if (typeof value === 'boolean') {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = value;
      control = input;
    } else {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.value = String(value);
      control = input;
    }
    controls.set(key, control);
    label.appendChild(control);
    const help = HELP[key];
    if (help !== undefined) {
      const badge = document.createElement('span');
      badge.className = 'setup-help';
      badge.textContent = '?';
      badge.title = help;
      badge.setAttribute('aria-label', help);
      badge.setAttribute('role', 'note');
      badge.tabIndex = 0;
      label.appendChild(badge);
    }
    form.appendChild(label);
  }

  /** Apply a mode's preset to the other controls so picking a mode rescales the world. */
  function applyPreset(mode: ViewMode): void {
    for (const [key, raw] of Object.entries(presetFor(mode))) {
      if (key === 'viewMode') continue;
      const control = controls.get(key);
      if (control === undefined) continue;
      if (control instanceof HTMLInputElement && control.type === 'checkbox') {
        control.checked = Boolean(raw);
      } else {
        control.value = String(raw);
      }
    }
  }

  /** Highlight a mode's card and sync the select, without touching the numbers. */
  function highlightMode(mode: ViewMode): void {
    for (const [m, button] of modeButtons) {
      button.setAttribute('aria-pressed', m === mode ? 'true' : 'false');
    }
    if (viewModeSelect !== undefined) viewModeSelect.value = mode;
  }

  /** Pick a world: highlight its card, sync the select, and rescale the form to its preset. */
  function selectMode(mode: ViewMode): void {
    highlightMode(mode);
    applyPreset(mode);
  }

  // A shared link seeds exact numbers (highlight only); a fresh form applies the
  // default mode's preset so mode and numbers start consistent.
  if (initial !== undefined) highlightMode(initial.viewMode);
  else selectMode(DEFAULT_PARAMETERS.viewMode);

  /** Read the current form values back into a parameter set. */
  function readParams(): SimulationParameters {
    const params: SimulationParameters = { ...DEFAULT_PARAMETERS };
    const target = params as unknown as Record<string, unknown>;
    for (const [key, control] of controls) {
      const fallback = DEFAULT_PARAMETERS[key as keyof SimulationParameters];
      if (key === 'viewMode') {
        target[key] = control.value;
      } else if (typeof fallback === 'boolean') {
        target[key] = (control as HTMLInputElement).checked;
      } else {
        target[key] = Number(control.value);
      }
    }
    return params;
  }

  // "Copy share link": encode the current form into a #w=… URL and copy it. The
  // run is reproducible from these parameters, so the link hands over the world.
  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'setup-share';
  share.textContent = 'Copy share link 🔗';
  share.setAttribute('aria-live', 'polite');
  share.addEventListener('click', () => {
    const hash = `${SHARE_HASH_PREFIX}${encodeParams(readParams())}`;
    const url = `${location.origin}${location.pathname}${location.search}#${hash}`;
    const original = 'Copy share link 🔗';
    const confirm = (text: string): void => {
      share.textContent = text;
      window.setTimeout(() => {
        share.textContent = original;
      }, 1600);
    };
    if (navigator.clipboard?.writeText !== undefined) {
      navigator.clipboard.writeText(url).then(
        () => confirm('Link copied ✓'),
        () => {
          location.hash = hash; // fallback: the address bar now holds the link
          confirm('Link in address bar');
        },
      );
    } else {
      location.hash = hash;
      confirm('Link in address bar');
    }
  });
  form.appendChild(share);

  // Import an evolved population from a file and start a run from it.
  const importLabel = document.createElement('label');
  importLabel.className = 'setup-import';
  importLabel.textContent = 'Resume from a saved population: ';
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
  form.appendChild(importLabel);

  const start = document.createElement('button');
  start.type = 'submit';
  start.textContent = 'Breathe life into it →';
  form.appendChild(start);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onStart(readParams());
  });

  screen.appendChild(form);
  return screen;
}
