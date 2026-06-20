export interface Dock {
  element: HTMLElement;
  /** Region to mount the option controls into. */
  controlsHost: HTMLElement;
  /** Region to mount the scrollable message log into. */
  logHost: HTMLElement;
  /** Refresh the live stat readouts. */
  updateStats(population: number, species: number, tick: number): void;
  /** Set the pinned narrator line (empty hides it). */
  setNarration(text: string): void;
}

const fmt = (n: number): string => Math.round(n).toLocaleString('en-GB');

/**
 * The single toolbar (specification: relatability — a tidy, legible HUD). Holds
 * everything persistent in three regions — live stats, the option controls, and
 * the message log — laid out by CSS so the whole UI fits the viewport and only
 * the log scrolls. Detail panels (records, legend, inspector) are popovers opened
 * from the controls; they are not part of this always-on bar.
 */
export function createDock(): Dock {
  const element = document.createElement('div');
  element.className = 'dock';

  // --- Info: brand, live stats, pinned narrator line ---
  const info = document.createElement('div');
  info.className = 'dock-info';

  const brand = document.createElement('div');
  brand.className = 'dock-brand';
  brand.textContent = 'eek-a-volve';

  const stats = document.createElement('div');
  stats.className = 'dock-stats';
  const statValue = (label: string): HTMLElement => {
    const wrap = document.createElement('div');
    wrap.className = 'dock-stat';
    const l = document.createElement('span');
    l.className = 'dock-stat-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'dock-stat-value';
    v.textContent = '—';
    wrap.append(l, v);
    stats.appendChild(wrap);
    return v;
  };
  const popValue = statValue('Pop');
  const speciesValue = statValue('Species');
  const tickValue = statValue('Tick');

  const narr = document.createElement('div');
  narr.className = 'dock-narr';

  info.append(brand, stats, narr);

  // --- Controls and log regions (filled by the caller) ---
  const controlsHost = document.createElement('div');
  controlsHost.className = 'dock-controls';

  const logHost = document.createElement('div');
  logHost.className = 'dock-log';

  // Info + controls share the main column; the log sits beside it (desktop) or
  // below it (portrait) and is the only scrollable region.
  const main = document.createElement('div');
  main.className = 'dock-main';
  main.append(info, controlsHost);
  element.append(main, logHost);

  return {
    element,
    controlsHost,
    logHost,
    updateStats: (population, species, tick): void => {
      popValue.textContent = fmt(population);
      speciesValue.textContent = fmt(species);
      tickValue.textContent = fmt(tick);
    },
    setNarration: (text): void => {
      narr.textContent = text;
    },
  };
}
