import { DEFAULT_PARAMETERS, type SimulationParameters } from '../core/params.ts';

/** Turn a camelCase parameter key into a British-English label. */
function humanise(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Build the pre-start setup screen: a form over the whole `SimulationParameters`
 * object (number inputs and checkboxes), seeded from the defaults. On submit it
 * reads the values and calls `onStart` (specification: Scope — parameters are
 * configured before starting only).
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
  const inputs = new Map<string, HTMLInputElement>();

  for (const [key, value] of Object.entries(DEFAULT_PARAMETERS)) {
    const label = document.createElement('label');
    label.textContent = humanise(key);
    const input = document.createElement('input');
    if (typeof value === 'boolean') {
      input.type = 'checkbox';
      input.checked = value;
    } else {
      input.type = 'number';
      input.step = 'any';
      input.value = String(value);
    }
    inputs.set(key, input);
    label.appendChild(input);
    form.appendChild(label);
  }

  const start = document.createElement('button');
  start.type = 'submit';
  start.textContent = 'Start';
  form.appendChild(start);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const params: SimulationParameters = { ...DEFAULT_PARAMETERS };
    const target = params as Record<string, unknown>;
    for (const [key, input] of inputs) {
      const fallback = DEFAULT_PARAMETERS[key as keyof SimulationParameters];
      target[key] = typeof fallback === 'boolean' ? input.checked : Number(input.value);
    }
    onStart(params);
  });

  screen.appendChild(form);
  return screen;
}
