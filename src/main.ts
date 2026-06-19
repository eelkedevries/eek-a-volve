import './style.css';
import { createSetupScreen } from './ui/setupScreen.ts';
import { createControls } from './ui/controls.ts';
import { PopulationChart } from './ui/chart.ts';
import { Toasts } from './ui/toasts.ts';
import { SimulationClient } from './worker/client.ts';
import { Renderer } from './render/renderer.ts';
import { H_POPULATION } from './core/snapshot.ts';
import { NEAR_EXTINCTION_THRESHOLD } from './core/bounds.ts';
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
  if (mount === null) return;
  const renderer = new Renderer();
  await renderer.init(host, params.worldWidth, params.worldHeight);

  const chart = new PopulationChart();
  const toasts = new Toasts();
  mount.append(chart.element, toasts.element);

  const client = new SimulationClient();
  let frame = 0;
  let wasNearExtinction = false;
  client.start(params, (view, count) => {
    renderer.draw(view, count);
    const population = view[H_POPULATION];
    if (frame++ % 5 === 0) chart.push(population);
    const near = population > 0 && population <= NEAR_EXTINCTION_THRESHOLD;
    if (near && !wasNearExtinction) toasts.show(`Near extinction — only ${population} left!`);
    wasNearExtinction = near;
  });

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

showSetup();
