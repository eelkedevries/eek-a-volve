import './style.css';
import { SimulationClient } from './worker/client.ts';
import { DEFAULT_PARAMETERS } from './core/params.ts';
import { Renderer } from './render/renderer.ts';

async function main(): Promise<void> {
  const mount = document.querySelector<HTMLDivElement>('#app');
  if (mount === null) return;

  const renderer = new Renderer();
  await renderer.init(mount, DEFAULT_PARAMETERS.worldWidth, DEFAULT_PARAMETERS.worldHeight);

  const client = new SimulationClient();
  client.start(DEFAULT_PARAMETERS, (view, count) => renderer.draw(view, count));
}

void main();
