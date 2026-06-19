import { Narrator, DEFAULT_MODEL } from '../narrator/openrouter.ts';

export interface NarratorPanel {
  element: HTMLElement;
  narrator: Narrator;
  show(line: string): void;
}

/**
 * A small panel showing the latest narrator line, with a collapsible config for
 * the OpenRouter key and model (stored in the browser by the narrator).
 */
export function createNarratorPanel(): NarratorPanel {
  const narrator = new Narrator();

  const panel = document.createElement('div');
  panel.className = 'narrator';

  const line = document.createElement('div');
  line.className = 'narrator-line';

  const config = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'AI narrator (optional)';
  config.appendChild(summary);

  const keyInput = document.createElement('input');
  keyInput.type = 'password';
  keyInput.placeholder = 'OpenRouter API key (stored in your browser)';
  keyInput.value = narrator.getKey();
  keyInput.addEventListener('change', () => narrator.setKey(keyInput.value.trim()));

  const modelInput = document.createElement('input');
  modelInput.type = 'text';
  modelInput.placeholder = DEFAULT_MODEL;
  modelInput.value = narrator.getModel();
  modelInput.addEventListener('change', () => narrator.setModel(modelInput.value.trim() || DEFAULT_MODEL));

  config.append(keyInput, modelInput);
  panel.append(line, config);

  return {
    element: panel,
    narrator,
    show: (text: string): void => {
      line.textContent = text;
    },
  };
}
