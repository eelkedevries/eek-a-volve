import { icon, type IconName } from './icons.ts';
import { createEventList } from './eventViews.ts';
import type { StoryEvent, StoryLog } from './storyLog.ts';
import type { WinId } from './windowManager.ts';

/** The five window tiles offered on the Windows tab. */
const WINDOW_TILES: { id: WinId; label: string; icon: IconName }[] = [
  { id: 'legend', label: 'Legend', icon: 'legend' },
  { id: 'records', label: 'Records', icon: 'records' },
  { id: 'charts', label: 'Charts', icon: 'charts' },
  { id: 'family', label: 'Family', icon: 'family' },
  { id: 'map', label: 'Map', icon: 'map' },
];

type Tab = 'log' | 'windows' | 'settings';

export interface ToolbarWindowConfig {
  storyLog: StoryLog;
  /** Open the clicked event in the Event-detail window. */
  onOpenDetail: (event: StoryEvent) => void;
  /** Open the maximised Story-log window. */
  onMaximiseLog: () => void;
  /** Toggle a content window open/closed (Windows-tab tiles). */
  onToggleWindow: (id: WinId) => void;
  /** Whether a content window is currently open (drives tile highlight). */
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

export interface ToolbarWindow {
  element: HTMLElement;
  /** Refresh the live stat pills (throttled by the caller, ~8/s). */
  updateStats(gen: number, population: number, species: number, tick: number): void;
  /** Re-evaluate Windows-tab tile highlights + the "any open" dot. */
  refreshWindows(): void;
}

const fmt = (n: number): string => Math.round(n).toLocaleString('en-GB');

/** A small tile button (icon over label) with an active state. */
function tile(name: IconName, label: string): { button: HTMLButtonElement } {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ev-tile';
  button.appendChild(icon(name, 20));
  const text = document.createElement('span');
  text.className = 'ev-tile-label';
  text.textContent = label;
  button.appendChild(text);
  return { button };
}

/** A captioned section heading ("STORY LOG", "OPEN A WINDOW", …). */
function caption(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ev-caption';
  el.textContent = text;
  return el;
}

/**
 * The toolbar ("message") window (design: "2b. Toolbar window"). A single fixed
 * panel above the control bar holding the live stat pills, a Log/Windows/Settings
 * tab strip, and the one always-present scroll body that swaps content per tab —
 * the only scrollable region in the HUD, so tall content (Settings) scrolls
 * rather than clipping.
 */
export function createToolbarWindow(config: ToolbarWindowConfig): ToolbarWindow {
  const element = document.createElement('div');
  element.className = 'ev-toolbar-window';

  // --- Stat pills ---
  const pills = document.createElement('div');
  pills.className = 'ev-pills';
  const pill = (label: string, kind: string): HTMLElement => {
    const wrap = document.createElement('div');
    wrap.className = `ev-pill ev-pill-${kind}`;
    const l = document.createElement('div');
    l.className = 'ev-pill-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = 'ev-pill-value';
    v.textContent = '0';
    wrap.append(l, v);
    pills.appendChild(wrap);
    return v;
  };
  const genValue = pill('Gen', 'gen');
  const popValue = pill('Pop', 'pop');
  const speciesValue = pill('Species', 'species');
  const tickValue = pill('Ticks', 'ticks');

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

  // --- Scroll body (the single scroller) ---
  const body = document.createElement('div');
  body.className = 'ev-toolbar-body ev-scroll';

  // Log pane: caption + maximise + the compact event list.
  const logPane = document.createElement('div');
  logPane.className = 'ev-pane';
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
  maximise.title = 'Open log as window';
  maximise.setAttribute('aria-label', 'Open log as window');
  maximise.appendChild(icon('maximise', 13));
  maximise.addEventListener('click', () => config.onMaximiseLog());
  logHead.append(logDot, logTitle, maximise);
  const eventList = createEventList('compact', config.onOpenDetail);
  logPane.append(logHead, eventList.element);

  // Windows pane: a 5-up tile grid + Close all / Hide UI.
  const windowsPane = document.createElement('div');
  windowsPane.className = 'ev-pane';
  windowsPane.appendChild(caption('Open a window'));
  const tileGrid = document.createElement('div');
  tileGrid.className = 'ev-tile-grid ev-tile-grid-5';
  const windowTileButtons = new Map<WinId, HTMLButtonElement>();
  for (const t of WINDOW_TILES) {
    const { button } = tile(t.icon, t.label);
    button.addEventListener('click', () => {
      config.onToggleWindow(t.id);
    });
    windowTileButtons.set(t.id, button);
    tileGrid.appendChild(button);
  }
  const divider1 = document.createElement('div');
  divider1.className = 'ev-divider';
  const actionRow = document.createElement('div');
  actionRow.className = 'ev-tile-grid ev-tile-grid-2';
  const closeAllTile = tile('closeAll', 'Close all');
  closeAllTile.button.addEventListener('click', () => config.onCloseAll());
  const hideTile = tile('eyeOff', 'Hide UI');
  hideTile.button.addEventListener('click', () => config.onHideUI());
  actionRow.append(closeAllTile.button, hideTile.button);
  windowsPane.append(tileGrid, divider1, actionRow);

  // Settings pane: playback toggles + palette/quality + danger zone.
  const settingsPane = document.createElement('div');
  settingsPane.className = 'ev-pane';
  settingsPane.appendChild(caption('Playback & view'));
  const toggleRow = document.createElement('div');
  toggleRow.className = 'ev-tile-grid ev-tile-grid-3';
  const makeToggle = (
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
    toggleRow.appendChild(button);
  };
  makeToggle('director', 'Director', config.director, config.onDirector);
  makeToggle('sound', 'Sound', config.sound, config.onSound);
  makeToggle('calm', 'Calm', config.calm, config.onCalm);

  const selects = document.createElement('div');
  selects.className = 'ev-selects';
  const select = (
    label: string,
    options: { value: string; text: string }[],
    initial: string,
    onChange: (value: string) => void,
  ): void => {
    const wrap = document.createElement('label');
    wrap.className = 'ev-select';
    const l = document.createElement('span');
    l.textContent = label;
    const sel = document.createElement('select');
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.text;
      sel.appendChild(opt);
    }
    sel.value = initial;
    sel.addEventListener('change', () => onChange(sel.value));
    wrap.append(l, sel);
    selects.appendChild(wrap);
  };
  select(
    'Palette',
    config.palettes.map((name, i) => ({ value: String(i), text: name })),
    '0',
    (value) => config.onPalette(Number(value)),
  );
  select(
    'Quality',
    [
      { value: 'low', text: 'Low' },
      { value: 'medium', text: 'Medium' },
      { value: 'high', text: 'High' },
    ],
    config.quality,
    (value) => config.onQuality(value as 'low' | 'medium' | 'high'),
  );

  const divider2 = document.createElement('div');
  divider2.className = 'ev-divider';
  settingsPane.append(toggleRow, selects, divider2, caption('Danger zone'));
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'ev-reset-btn';
  resetBtn.appendChild(icon('reset', 16));
  const resetText = document.createElement('span');
  resetText.textContent = 'Reset simulation';
  resetBtn.appendChild(resetText);
  resetBtn.addEventListener('click', () => config.onReset());
  settingsPane.appendChild(resetBtn);

  body.append(logPane, windowsPane, settingsPane);
  element.append(pills, tabs, body);

  // --- Tab state ---
  const panes: Record<Tab, HTMLElement> = { log: logPane, windows: windowsPane, settings: settingsPane };
  function selectTab(tab: Tab): void {
    for (const [id, button] of tabButtons) button.classList.toggle('is-active', id === tab);
    for (const [id, pane] of Object.entries(panes)) {
      pane.style.display = id === tab ? '' : 'none';
    }
    body.scrollTop = 0;
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
