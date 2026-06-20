import type { SimulationClient } from '../worker/client.ts';

export interface ControlsConfig {
  client: SimulationClient;
  /** Time-multiplier bounds (ticks per rendered frame). */
  min: number;
  max: number;
  onReset: () => void;
  /** Whether the auto-director starts enabled. */
  directorEnabled: boolean;
  /** Toggle the auto-director on/off. */
  onToggleDirector: (on: boolean) => void;
  /** Open/close the legend. */
  onLegend: () => void;
  /** Open/close the hall-of-fame / stats popover. */
  onRecords: () => void;
  /** Open/close the live charts popover. */
  onCharts: () => void;
  /** Open/close the family-tree popover. */
  onFamily: () => void;
  /** Export the current population to a downloadable file. */
  onExport: () => void;
  /** Cycle the field overlay (off → fertility → pheromone). */
  onOverlay: (mode: 'off' | 'fertility' | 'pheromone') => void;
  /** Choose how creature bodies are coloured. */
  onColourMode: (mode: 'species' | 'diet' | 'size' | 'sense') => void;
  /** Selectable species palette names; index passed back on change. */
  palettes: string[];
  onPalette: (index: number) => void;
  /** Quality/scale level. */
  onQuality: (level: 'low' | 'medium' | 'high') => void;
  /** Whether reduced motion starts on (e.g. from the OS preference). */
  reducedMotion: boolean;
  onReducedMotion: (on: boolean) => void;
  /** Whether sound starts on (off by default; remembered in localStorage). */
  soundEnabled: boolean;
  onToggleSound: (on: boolean) => void;
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

  let directing = config.directorEnabled;
  const director = document.createElement('button');
  const directorLabel = (): string => `🎬 Director: ${directing ? 'on' : 'off'}`;
  director.textContent = directorLabel();
  director.addEventListener('click', () => {
    directing = !directing;
    director.textContent = directorLabel();
    config.onToggleDirector(directing);
  });

  const legend = document.createElement('button');
  legend.textContent = '🛈 Legend';
  legend.addEventListener('click', () => config.onLegend());

  const recordsBtn = document.createElement('button');
  recordsBtn.textContent = '🏆 Records';
  recordsBtn.addEventListener('click', () => config.onRecords());

  const chartsBtn = document.createElement('button');
  chartsBtn.textContent = '📈 Charts';
  chartsBtn.addEventListener('click', () => config.onCharts());

  const familyBtn = document.createElement('button');
  familyBtn.textContent = '📜 Family';
  familyBtn.addEventListener('click', () => config.onFamily());

  const overlayModes = ['off', 'fertility', 'pheromone'] as const;
  const overlayName = { off: 'off', fertility: 'biome', pheromone: 'trails' };
  let overlayIndex = 0;
  const overlayBtn = document.createElement('button');
  const overlayLabel = (): string => `🗺️ Overlay: ${overlayName[overlayModes[overlayIndex]]}`;
  overlayBtn.textContent = overlayLabel();
  overlayBtn.addEventListener('click', () => {
    overlayIndex = (overlayIndex + 1) % overlayModes.length;
    overlayBtn.textContent = overlayLabel();
    config.onOverlay(overlayModes[overlayIndex]);
  });

  const colourLabel = document.createElement('label');
  colourLabel.className = 'control-select';
  const colour = document.createElement('select');
  for (const [value, text] of [
    ['species', 'Species'],
    ['diet', 'Diet'],
    ['size', 'Size'],
    ['sense', 'Sense'],
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    colour.appendChild(option);
  }
  colour.addEventListener('change', () =>
    config.onColourMode(colour.value as 'species' | 'diet' | 'size' | 'sense'),
  );
  colourLabel.append('Colour', colour);

  const paletteLabel = document.createElement('label');
  paletteLabel.className = 'control-select';
  const palette = document.createElement('select');
  config.palettes.forEach((name, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = name;
    palette.appendChild(option);
  });
  palette.addEventListener('change', () => config.onPalette(Number(palette.value)));
  paletteLabel.append('Palette', palette);

  const qualityLabel = document.createElement('label');
  qualityLabel.className = 'control-select';
  const quality = document.createElement('select');
  for (const level of ['low', 'medium', 'high'] as const) {
    const option = document.createElement('option');
    option.value = level;
    option.textContent = level.charAt(0).toUpperCase() + level.slice(1);
    if (level === 'medium') option.selected = true;
    quality.appendChild(option);
  }
  quality.addEventListener('change', () =>
    config.onQuality(quality.value as 'low' | 'medium' | 'high'),
  );
  qualityLabel.append('Quality', quality);

  const motionLabel = document.createElement('label');
  motionLabel.className = 'control-check';
  const motion = document.createElement('input');
  motion.type = 'checkbox';
  motion.checked = config.reducedMotion;
  motion.addEventListener('change', () => config.onReducedMotion(motion.checked));
  motionLabel.append(motion, 'Reduce motion');

  let sounding = config.soundEnabled;
  const sound = document.createElement('button');
  const soundLabel = (): string => (sounding ? '🔊 Sound: on' : '🔈 Sound: off');
  sound.textContent = soundLabel();
  sound.addEventListener('click', () => {
    sounding = !sounding;
    sound.textContent = soundLabel();
    config.onToggleSound(sounding);
  });

  const exportBtn = document.createElement('button');
  exportBtn.textContent = '💾 Export';
  exportBtn.addEventListener('click', () => config.onExport());

  const reset = document.createElement('button');
  reset.textContent = 'Reset';
  reset.addEventListener('click', () => config.onReset());

  bar.append(
    pause,
    speedLabel,
    director,
    legend,
    recordsBtn,
    chartsBtn,
    familyBtn,
    overlayBtn,
    colourLabel,
    paletteLabel,
    qualityLabel,
    motionLabel,
    sound,
    exportBtn,
    reset,
  );
  return bar;
}
