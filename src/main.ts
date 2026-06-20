import './style.css';
import { createSetupScreen } from './ui/setupScreen.ts';
import { createControls } from './ui/controls.ts';
import { PopulationChart } from './ui/chart.ts';
import { Toasts } from './ui/toasts.ts';
import { createNarratorPanel } from './ui/narratorPanel.ts';
import { Milestones } from './humour/milestones.ts';
import { SimulationClient } from './worker/client.ts';
import { Renderer } from './render/renderer.ts';
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
import type { SimulationParameters } from './core/params.ts';

const mount = document.querySelector<HTMLDivElement>('#app');
const NARRATE_EVERY_FRAMES = 150;

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
  await renderer.init(host, params.worldWidth, params.worldHeight, params.viewMode);

  const chart = new PopulationChart();
  const toasts = new Toasts();
  const narratorUI = createNarratorPanel();
  mount.append(chart.element, toasts.element, narratorUI.element);

  const milestones = new Milestones();
  const client = new SimulationClient();
  let frame = 0;
  let wasNearExtinction = false;

  client.start(params, (view, count) => {
    renderer.draw(view, count);
    const population = view[H_POPULATION];
    if (frame % 5 === 0) chart.push(population);

    const near = population > 0 && population <= NEAR_EXTINCTION_THRESHOLD;
    if (near && !wasNearExtinction) toasts.show(`Near extinction — only ${population} left!`);
    wasNearExtinction = near;

    if (frame % NARRATE_EVERY_FRAMES === 0) {
      const milestone = milestones.update({
        tick: view[H_TICK],
        population,
        speciesCount: view[H_SPECIES_COUNT],
        event: null,
      });
      if (milestone !== null) toasts.show(milestone);
      const stats = {
        tick: view[H_TICK],
        population,
        births: view[H_BIRTHS],
        deaths: view[H_DEATHS],
        speciesCount: view[H_SPECIES_COUNT],
        traitMeans: view.subarray(H_TRAIT_MEANS, H_TRAIT_MEANS + TRAIT_COUNT),
        milestone,
      };
      narratorUI.show(narratorUI.narrator.narrate(stats, (line) => narratorUI.show(line)));
    }
    frame++;
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
