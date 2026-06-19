import type { SimulationClient } from '../worker/client.ts';

export interface ControlsConfig {
  client: SimulationClient;
  /** Time-multiplier bounds (ticks per rendered frame). */
  min: number;
  max: number;
  onReset: () => void;
}

/**
 * The only post-start controls: pause/resume, the time multiplier, and reset
 * (specification: Scope — after start, only the multiplier and pause change;
 * reset returns to the setup screen).
 */
export function createControls(config: ControlsConfig): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'controls';

  let paused = false;
  const pause = document.createElement('button');
  pause.textContent = 'Pause';
  pause.addEventListener('click', () => {
    paused = !paused;
    if (paused) {
      config.client.pause();
      pause.textContent = 'Resume';
    } else {
      config.client.resume();
      pause.textContent = 'Pause';
    }
  });

  const speedLabel = document.createElement('label');
  speedLabel.className = 'speed';
  const speed = document.createElement('input');
  speed.type = 'range';
  speed.min = String(config.min);
  speed.max = String(config.max);
  speed.step = 'any';
  speed.value = '1';
  const readout = document.createElement('span');
  readout.textContent = '1.0×';
  speed.addEventListener('input', () => {
    const multiplier = Number(speed.value);
    config.client.setMultiplier(multiplier);
    readout.textContent = `${multiplier.toFixed(1)}×`;
  });
  speedLabel.append('Speed', speed, readout);

  const reset = document.createElement('button');
  reset.textContent = 'Reset';
  reset.addEventListener('click', () => config.onReset());

  bar.append(pause, speedLabel, reset);
  return bar;
}
