import './style.css';
import { createSetupScreen } from './ui/setupScreen.ts';
import { createControls } from './ui/controls.ts';
import { SimulationClient } from './worker/client.ts';
import { Renderer } from './render/renderer.ts';
import type { SimulationParameters } from './core/params.ts';

const mount = document.querySelector<HTMLDivElement>('#app');

function showSetup(): void {
  if (mount === null) return;
  mount.innerHTML = '';
  mount.appendChild(createSetupScreen(start));
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
  const renderer = new Renderer();
  await renderer.init(host, params.worldWidth, params.worldHeight);

  const client = new SimulationClient();
  client.start(params, (view, count) => renderer.draw(view, count));

  if (mount !== null) {
    mount.appendChild(
      createControls({
        client,
        min: params.minTimeMultiplier,
        max: params.maxTimeMultiplier,
        onReset: () => {
          client.dispose();
          showSetup();
        },
      }),
    );
  }
}

showSetup();
