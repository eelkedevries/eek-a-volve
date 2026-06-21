import { icon, type IconName } from './icons.ts';
import { createEventList } from './eventViews.ts';
import type { StoryEvent, StoryLog } from './storyLog.ts';
import type { WinId } from './windowManager.ts';
import type { SimulationClient } from '../worker/client.ts';

/** The Windows tab: one row of seven buttons (5 window toggles + 2 actions). */
const WINDOW_TILES: { id: WinId; label: string; icon: IconName }[] = [
  { id: 'legend', label: 'Legend', icon: 'legend' },
  { id: 'records', label: 'Records', icon: 'records' },
  { id: 'charts', label: 'Charts', icon: 'charts' },
  { id: 'family', label: 'Family', icon: 'family' },
  { id: 'map', label: 'Map', icon: 'map' },
];

const QUALITIES = ['low', 'medium', 'high'] as const;
const QUALITY_LABEL: Record<string, string> = { low: 'Low', medium: 'Med', high: 'High' };

type Tab = 'log' | 'windows' | 'settings';

export interface ToolbarConfig {
  client: SimulationClient;
  /** Time-multiplier bounds for the speed adjuster. */
  min: number;
  max: number;
  storyLog: StoryLog;
  onOpenDetail: (event: StoryEvent) => void;
  onMaximiseLog: () => void;
  onToggleWindow: (id: WinId) => void;
  isWindowOpen: (id: WinId) => boolean;
  onCloseAll: () => void;
  onHideUI: () => void;
  onReset: () => void;
  director: boolean;
  onDirector: (on: boolean) => void;
  sound: boolean;
  onSound: (on: boolean) => void;
  /** "Calm" — reduced motion. */
  calm: boolean;
  onCalm: (on: boolean) => void;
  palettes: string[];
  onPalette: (index: number) => void;
  quality: 'low' | 'medium' | 'high';
  onQuality: (level: 'low' | 'medium' | 'high') => void;
}

export interface Toolbar {
  element: HTMLElement;
  /** Refresh the live stats in the bottom row (throttled by the caller, ~8/s). */
  updateStats(gen: number, population: number, species: number, tick: number): void;
  /** Re-evaluate Windows-tab tile highlights + the "any open" dot. */
  refreshWindows(): void;
}

const fmt = (n: number): string => Math.round(n).toLocaleString('en-GB');

/** A short, readable palette name for a cycle button. */
function paletteShort(name: string): string {
  return /blind/i.test(name) ? 'Safe' : name;
}

/** A tile button (icon over label) with a settable label, for the 1-row tabs. */
function tile(name: IconName, label: string): { button: HTMLButtonElement; label: HTMLElement } {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ev-tile';
  button.appendChild(icon(name, 20));
  const text = document.createElement('span');
  text.className = 'ev-tile-label';
  text.textContent = label;
  button.appendChild(text);
  return { button, label: text };
}

/**
 * The toolbar (UI vocabulary: the one-piece UI pinned to the bottom). A
 * Log/Windows/Settings tab strip over the active subsection, and an attached
 * bottom row holding play/pause, the speed adjuster, and the live stats
 * (Gen/Pop/Species/Ticks). Windows is one row of seven buttons; Settings is one
 * row of six; Log shows the latest two messages and can be maximised into the
 * full Story-log window in the world.
 */
export function createToolbar(config: ToolbarConfig): Toolbar {
  const element = document.createElement('div');
  element.className = 'ev-toolbar';

  // --- Tab strip ---
  const tabs = document.createElement('div');
  tabs.className = 'ev-tabs';
  const tabButtons = new Map<Tab, HTMLButtonElement>();
  const windowsDot = document.createElement('span');
  windowsDot.className = 'ev-tab-dot';
  const tabButton = (id: Tab, name: IconName, label: string, extra?: HTMLElement): void => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ev-tab';
    button.appendChild(icon(name, 14));
    const text = document.createElement('span');
    text.textContent = label;
    button.appendChild(text);
    if (extra !== undefined) button.appendChild(extra);
    button.addEventListener('click', () => selectTab(id));
    tabs.appendChild(button);
    tabButtons.set(id, button);
  };
  tabButton('log', 'log', 'Log');
  tabButton('windows', 'windows', 'Windows', windowsDot);
  tabButton('settings', 'settings', 'Settings');

  // --- Subsection body ---
  const body = document.createElement('div');
  body.className = 'ev-toolbar-body';

  // Log: the latest two messages + a maximise affordance.
  const logPane = document.createElement('div');
  logPane.className = 'ev-pane ev-pane-log';
  const logHead = document.createElement('div');
  logHead.className = 'ev-loghead';
  const logDot = document.createElement('span');
  logDot.className = 'ev-loghead-dot';
  const logTitle = document.createElement('span');
  logTitle.className = 'ev-caption ev-loghead-title';
  logTitle.textContent = 'Story log';
  const maximise = document.createElement('button');
  maximise.type = 'button';
  maximise.className = 'ev-icon-btn';
  maximise.title = 'Open log as a window';
  maximise.setAttribute('aria-label', 'Open log as a window');
  maximise.appendChild(icon('maximise', 13));
  maximise.addEventListener('click', () => config.onMaximiseLog());
  logHead.append(logDot, logTitle, maximise);
  const eventList = createEventList('compact', config.onOpenDetail, 2);
  logPane.append(logHead, eventList.element);

  // Windows: one row of seven buttons.
  const windowsPane = document.createElement('div');
  windowsPane.className = 'ev-pane ev-pane-row ev-pane-row-7';
  const windowTileButtons = new Map<WinId, HTMLButtonElement>();
  for (const t of WINDOW_TILES) {
    const { button } = tile(t.icon, t.label);
    button.addEventListener('click', () => config.onToggleWindow(t.id));
    windowTileButtons.set(t.id, button);
    windowsPane.appendChild(button);
  }
  const closeAllTile = tile('closeAll', 'Close all');
  closeAllTile.button.addEventListener('click', () => config.onCloseAll());
  const hideTile = tile('eyeOff', 'Hide UI');
  hideTile.button.addEventListener('click', () => config.onHideUI());
  windowsPane.append(closeAllTile.button, hideTile.button);

  // Settings: one row of six buttons.
  const settingsPane = document.createElement('div');
  settingsPane.className = 'ev-pane ev-pane-row ev-pane-row-6';
  const toggleTile = (
    name: IconName,
    label: string,
    initial: boolean,
    onChange: (on: boolean) => void,
  ): void => {
    const { button } = tile(name, label);
    let on = initial;
    button.classList.toggle('is-active', on);
    button.setAttribute('aria-pressed', String(on));
    button.addEventListener('click', () => {
      on = !on;
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-pressed', String(on));
      onChange(on);
    });
    settingsPane.appendChild(button);
  };
  toggleTile('director', 'Director', config.director, config.onDirector);
  toggleTile('sound', 'Sound', config.sound, config.onSound);
  toggleTile('calm', 'Calm', config.calm, config.onCalm);

  // Palette + Quality cycle through their options on click.
  let paletteIndex = 0;
  const palette = tile('palette', paletteShort(config.palettes[0] ?? 'Palette'));
  palette.button.addEventListener('click', () => {
    paletteIndex = (paletteIndex + 1) % config.palettes.length;
    palette.label.textContent = paletteShort(config.palettes[paletteIndex]);
    config.onPalette(paletteIndex);
  });
  let qualityIndex = Math.max(0, QUALITIES.indexOf(config.quality));
  const quality = tile('quality', QUALITY_LABEL[config.quality]);
  quality.button.addEventListener('click', () => {
    qualityIndex = (qualityIndex + 1) % QUALITIES.length;
    quality.label.textContent = QUALITY_LABEL[QUALITIES[qualityIndex]];
    config.onQuality(QUALITIES[qualityIndex]);
  });
  const reset = tile('reset', 'Reset');
  reset.button.classList.add('ev-tile-danger');
  reset.button.addEventListener('click', () => config.onReset());
  settingsPane.append(palette.button, quality.button, reset.button);

  body.append(logPane, windowsPane, settingsPane);

  // --- Bottom row: play/pause + speed + stats ---
  const bottom = document.createElement('div');
  bottom.className = 'ev-toolbar-bottom';

  let paused = false;
  const playGlyph = icon('play', 18);
  const pauseGlyph = icon('pause', 18);
  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.className = 'ev-play-btn';
  pauseBtn.title = 'Pause';
  pauseBtn.setAttribute('aria-label', 'Pause');
  pauseBtn.appendChild(pauseGlyph);
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    if (paused) {
      config.client.pause();
      pauseBtn.replaceChildren(playGlyph);
      pauseBtn.title = pauseBtn.ariaLabel = 'Resume';
    } else {
      config.client.resume();
      pauseBtn.replaceChildren(pauseGlyph);
      pauseBtn.title = pauseBtn.ariaLabel = 'Pause';
    }
  });

  const speedWrap = document.createElement('div');
  speedWrap.className = 'ev-speed';
  const speedLabel = document.createElement('span');
  speedLabel.className = 'ev-speed-label';
  speedLabel.textContent = 'Speed';
  // A logarithmic speed control: equal slider travel changes the multiplier by
  // equal ratios, so the slow end (down to config.min) gets real, usable range
  // instead of being crammed into the far-left sliver of a linear slider.
  const ratio = config.max / config.min;
  const toMultiplier = (t: number): number => config.min * Math.pow(ratio, t);
  const toSlider = (m: number): number => Math.log(m / config.min) / Math.log(ratio);
  const speed = document.createElement('input');
  speed.type = 'range';
  speed.className = 'ev-range';
  speed.min = '0';
  speed.max = '1';
  speed.step = '0.001';
  speed.value = String(toSlider(1)); // the run starts at 1.00×
  speed.setAttribute('aria-label', 'Speed');
  const speedValue = document.createElement('span');
  speedValue.className = 'ev-speed-value';
  speedValue.textContent = '1.00×';
  speed.addEventListener('input', () => {
    const multiplier = toMultiplier(Number(speed.value));
    config.client.setMultiplier(multiplier);
    speedValue.textContent = `${multiplier.toFixed(2)}×`;
  });
  speedWrap.append(speedLabel, speed, speedValue);

  const stats = document.createElement('div');
  stats.className = 'ev-stats';
  const stat = (label: string, kind: string): HTMLElement => {
    const wrap = document.createElement('div');
    wrap.className = `ev-stat ev-stat-${kind}`;
    const l = document.createElement('div');
    l.className = 'ev-stat-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = 'ev-stat-value';
    v.textContent = '0';
    wrap.append(l, v);
    stats.appendChild(wrap);
    return v;
  };
  const genValue = stat('Gen', 'gen');
  const popValue = stat('Pop', 'pop');
  const speciesValue = stat('Species', 'species');
  const tickValue = stat('Ticks', 'ticks');

  bottom.append(pauseBtn, speedWrap, stats);

  element.append(tabs, body, bottom);

  // --- Tab state ---
  const panes: Record<Tab, HTMLElement> = { log: logPane, windows: windowsPane, settings: settingsPane };
  function selectTab(tab: Tab): void {
    for (const [id, button] of tabButtons) button.classList.toggle('is-active', id === tab);
    for (const [id, pane] of Object.entries(panes)) pane.style.display = id === tab ? '' : 'none';
  }
  selectTab('log');

  // The Log tab and the Story-log window share one source; re-render on change.
  const renderLog = (): void => eventList.render(config.storyLog.getEvents());
  config.storyLog.onChange(renderLog);
  renderLog();

  function refreshWindows(): void {
    let anyOpen = false;
    for (const [id, button] of windowTileButtons) {
      const open = config.isWindowOpen(id);
      button.classList.toggle('is-active', open);
      if (open) anyOpen = true;
    }
    windowsDot.classList.toggle('is-on', anyOpen);
  }
  refreshWindows();

  return {
    element,
    updateStats: (gen, population, species, tick): void => {
      genValue.textContent = fmt(gen);
      popValue.textContent = fmt(population);
      speciesValue.textContent = fmt(species);
      tickValue.textContent = fmt(tick);
    },
    refreshWindows,
  };
}
