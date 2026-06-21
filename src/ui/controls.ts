import type { SimulationClient } from '../worker/client.ts';
import { icon } from './icons.ts';

export interface ControlBarConfig {
  client: SimulationClient;
  /** Time-multiplier bounds (ticks per rendered frame). */
  min: number;
  max: number;
}

/**
 * The bottom control bar (design: "2a. Bottom control bar"). The only persistent
 * controls — pause/resume and the time multiplier — in a 58px bar pinned to the
 * bottom edge. Everything else lives in the toolbar window (specification: Scope —
 * after start, only the multiplier and pause change).
 */
export function createControlBar(config: ControlBarConfig): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'ev-controlbar';

  let paused = false;
  const playGlyph = icon('play', 18);
  const pauseGlyph = icon('pause', 18);
  const pause = document.createElement('button');
  pause.type = 'button';
  pause.className = 'ev-play-btn';
  pause.title = 'Pause';
  pause.setAttribute('aria-label', 'Pause');
  pause.appendChild(pauseGlyph);
  pause.addEventListener('click', () => {
    paused = !paused;
    if (paused) {
      config.client.pause();
      pause.replaceChildren(playGlyph);
      pause.title = pause.ariaLabel = 'Resume';
    } else {
      config.client.resume();
      pause.replaceChildren(pauseGlyph);
      pause.title = pause.ariaLabel = 'Pause';
    }
  });

  const speedWrap = document.createElement('div');
  speedWrap.className = 'ev-speed';
  const speedLabel = document.createElement('span');
  speedLabel.className = 'ev-speed-label';
  speedLabel.textContent = 'Speed';
  const speed = document.createElement('input');
  speed.type = 'range';
  speed.className = 'ev-range';
  speed.min = String(config.min);
  speed.max = String(config.max);
  speed.step = '0.05';
  speed.value = '1';
  speed.setAttribute('aria-label', 'Speed');
  const readout = document.createElement('span');
  readout.className = 'ev-speed-value';
  readout.textContent = '1.00×';
  speed.addEventListener('input', () => {
    const multiplier = Number(speed.value);
    config.client.setMultiplier(multiplier);
    readout.textContent = `${multiplier.toFixed(2)}×`;
  });
  speedWrap.append(speedLabel, speed, readout);

  bar.append(pause, speedWrap);
  return bar;
}
