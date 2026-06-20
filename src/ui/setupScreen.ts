import {
  DEFAULT_PARAMETERS,
  COMMUNITY_PRESET,
  SWARM_PRESET,
  type SimulationParameters,
} from '../core/params.ts';

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

/**
 * Build the pre-start setup screen: a form over the whole `SimulationParameters`
 * object (number inputs, checkboxes, and the view-mode select), seeded from the
 * defaults. Picking a view mode rescales the world by applying that mode's
 * preset to the other fields. On submit it reads the values and calls `onStart`
 * (specification: Scope — parameters are configured before starting only).
 */
export function createSetupScreen(onStart: (params: SimulationParameters) => void): HTMLElement {
  const screen = document.createElement('div');
  screen.className = 'setup-screen';

  const title = document.createElement('h1');
  title.textContent = 'eek-a-volve';
  screen.appendChild(title);

  const blurb = document.createElement('p');
  blurb.textContent =
    'Configure the world, then set it running. Afterwards only speed and pause change.';
  screen.appendChild(blurb);

  const form = document.createElement('form');
  form.className = 'setup-form';
  const controls = new Map<string, HTMLInputElement | HTMLSelectElement>();

  for (const [key, value] of Object.entries(DEFAULT_PARAMETERS)) {
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
      select.addEventListener('change', () => applyPreset(select.value as ViewMode));
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

  // Seed the form with the default mode's preset so mode and numbers start consistent.
  applyPreset(DEFAULT_PARAMETERS.viewMode);

  const start = document.createElement('button');
  start.type = 'submit';
  start.textContent = 'Start';
  form.appendChild(start);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
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
    onStart(params);
  });

  screen.appendChild(form);
  return screen;
}
