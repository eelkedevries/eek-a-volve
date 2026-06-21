import { icon, type IconName } from './icons.ts';
import { windowArea, type Rect } from './layout.ts';

/** The floating windows the HUD can open (design: "Floating windows"). */
export type WinId =
  | 'inspector'
  | 'legend'
  | 'records'
  | 'charts'
  | 'family'
  | 'map'
  | 'eventlog'
  | 'detail';

/** A window's size class: small (25%), large (50%), maximise (100%). */
export type WinSize = 's' | 'l' | 'm';

interface WinMeta {
  title: string;
  icon: IconName;
  /** Header type-icon colour. */
  accent: string;
}

const WINMETA: Record<WinId, WinMeta> = {
  inspector: { title: 'Creature', icon: 'inspector', accent: '#5cff8f' },
  legend: { title: 'How to read the world', icon: 'legend', accent: '#7fe0ff' },
  records: { title: 'Hall of fame', icon: 'records', accent: '#ffd24a' },
  charts: { title: 'Population over time', icon: 'charts', accent: '#c9f24a' },
  family: { title: 'Lineage', icon: 'family', accent: '#ff9dd6' },
  map: { title: 'World map', icon: 'map', accent: '#a9c4ff' },
  eventlog: { title: 'Story log', icon: 'log', accent: '#7fe0ff' },
  detail: { title: 'Event detail', icon: 'detail', accent: '#c9f24a' },
};

/** Up to four windows tile the world. */
const MAX_WINDOWS = 4;

/** Quadrant cells of the world (2×2). 50% = a full row; 100% = all four. */
type Cell = 'tl' | 'tr' | 'bl' | 'br';

/** Cells each size occupies (drives the no-overlap packing). */
const CELL_COUNT: Record<WinSize, number> = { s: 1, l: 2, m: 4 };

interface Frame {
  id: WinId;
  el: HTMLElement;
  body: HTMLElement;
  sizeButtons: Record<WinSize, HTMLButtonElement>;
}

export interface WindowManagerConfig {
  /** Persistent body element per window id (reparented in/out as windows open/close). */
  bodies: Record<WinId, HTMLElement>;
  /** Called after a window closes (e.g. clear the renderer selection for the inspector). */
  onClose?: (id: WinId) => void;
  /** Called when a window is (re)sized or laid out, so canvas bodies can redraw. */
  onResize?: (id: WinId) => void;
  /** Called whenever the open set changes (drives the Windows-tab dot + tile highlights). */
  onChange?: () => void;
}

export interface WindowManager {
  /** The window layer (pointer-events: none; individual frames re-enable). */
  element: HTMLElement;
  open(id: WinId): void;
  close(id: WinId): void;
  toggle(id: WinId): void;
  closeAll(): void;
  isOpen(id: WinId): boolean;
  openIds(): WinId[];
  /** Re-tile against the current toolbar height (call on resize / toolbar resize). */
  relayout(toolbarHeight: number): void;
}

/** Geometry for the quadrant cells, full rows, and the whole world. */
function cellGeometry(area: Rect & { gap: number }): {
  cell: Record<Cell, Rect>;
  rowTop: Rect;
  rowBottom: Rect;
  full: Rect;
} {
  const halfW = (area.width - area.gap) / 2;
  const halfH = (area.height - area.gap) / 2;
  const rightCol = area.left + halfW + area.gap;
  const lowerRow = area.top + halfH + area.gap;
  return {
    cell: {
      tl: { left: area.left, top: area.top, width: halfW, height: halfH },
      tr: { left: rightCol, top: area.top, width: halfW, height: halfH },
      bl: { left: area.left, top: lowerRow, width: halfW, height: halfH },
      br: { left: rightCol, top: lowerRow, width: halfW, height: halfH },
    },
    rowTop: { left: area.left, top: area.top, width: area.width, height: halfH },
    rowBottom: { left: area.left, top: lowerRow, width: area.width, height: halfH },
    full: { left: area.left, top: area.top, width: area.width, height: area.height },
  };
}

/**
 * The floating-window manager (design: "Sizing & tiling model"). Owns a layer of
 * uniform window frames that tile the **world** without ever overlapping: each
 * window may be a 25% quadrant, a 50% full-width half, or the 100% whole world.
 * A greedy packer honours the chosen sizes when they fit and demotes the largest
 * (oldest) window when they don't, so the total never exceeds the four quadrants.
 * Window body elements are created once by their content components and
 * reparented in and out, so their live `update` methods keep working.
 */
export function createWindowManager(config: WindowManagerConfig): WindowManager {
  const element = document.createElement('div');
  element.className = 'ev-window-layer';

  const order: WinId[] = [];
  const sizes = new Map<WinId, WinSize>();
  const frames = new Map<WinId, Frame>();
  let toolbarHeight = 0;

  function buildFrame(id: WinId): Frame {
    const meta = WINMETA[id];
    const el = document.createElement('div');
    el.className = 'ev-window';
    el.dataset.win = id;

    const head = document.createElement('div');
    head.className = 'ev-window-head';

    const typeIcon = icon(meta.icon, 20);
    typeIcon.style.color = meta.accent;

    const title = document.createElement('span');
    title.className = 'ev-window-title';
    title.textContent = meta.title;

    const sizeButton = (size: WinSize, name: IconName, label: string): HTMLButtonElement => {
      const button = document.createElement('button');
      button.className = 'ev-winbtn';
      button.title = label;
      button.setAttribute('aria-label', label);
      button.appendChild(icon(name, 13));
      button.addEventListener('click', () => setSize(id, size));
      return button;
    };
    const small = sizeButton('s', 'sizeSmall', 'Small (25%)');
    const medium = sizeButton('l', 'sizeLarge', 'Medium (50%)');
    const large = sizeButton('m', 'sizeMax', 'Large (100%)');

    const close = document.createElement('button');
    close.className = 'ev-winbtn ev-winbtn-close';
    close.title = 'Close';
    close.setAttribute('aria-label', 'Close');
    close.appendChild(icon('close', 14));
    close.addEventListener('click', () => closeWindow(id));

    head.append(typeIcon, title, small, medium, large, close);

    const body = document.createElement('div');
    body.className = 'ev-window-body ev-scroll';
    body.appendChild(config.bodies[id]);

    el.append(head, body);
    return { id, el, body, sizeButtons: { s: small, l: medium, m: large } };
  }

  function setSize(id: WinId, size: WinSize): void {
    sizes.set(id, size);
    layout();
    config.onResize?.(id);
  }

  function openWindow(id: WinId): void {
    if (!order.includes(id)) {
      order.unshift(id);
      if (!sizes.has(id)) sizes.set(id, 's');
      const frame = buildFrame(id);
      frames.set(id, frame);
      element.appendChild(frame.el);
      while (order.length > MAX_WINDOWS) {
        const dropped = order.pop();
        if (dropped !== undefined) removeFrame(dropped);
      }
    }
    layout();
    config.onResize?.(id);
    config.onChange?.();
  }

  /** Tear a window down without firing onChange (used by close + overflow drop). */
  function removeFrame(id: WinId): void {
    const frame = frames.get(id);
    if (frame !== undefined) {
      // Preserve the body element (it has live update methods) by detaching it.
      if (frame.body.contains(config.bodies[id])) frame.body.removeChild(config.bodies[id]);
      frame.el.remove();
      frames.delete(id);
    }
    sizes.delete(id);
    const idx = order.indexOf(id);
    if (idx !== -1) order.splice(idx, 1);
    config.onClose?.(id);
  }

  function closeWindow(id: WinId): void {
    if (!order.includes(id) && !frames.has(id)) return;
    removeFrame(id);
    layout();
    config.onChange?.();
  }

  /** Pack the open windows into non-overlapping cells, returning each window's
   *  rectangle and the (possibly demoted) effective size used. */
  function pack(): Map<WinId, { rect: Rect; size: WinSize }> {
    const area = windowArea(toolbarHeight);
    const geo = cellGeometry(area);

    // Effective sizes start from the chosen sizes, then demote the largest
    // (oldest, to preserve recent intent) until the total fits four cells.
    const eff = new Map<WinId, WinSize>();
    for (const id of order) eff.set(id, sizes.get(id) ?? 's');
    const total = (): number => order.reduce((n, id) => n + CELL_COUNT[eff.get(id) ?? 's'], 0);
    while (total() > 4) {
      let victim: WinId | null = null;
      let victimCells = 1;
      order.forEach((id, i) => {
        const cells = CELL_COUNT[eff.get(id) ?? 's'];
        if (cells > 1 && (victim === null || cells > victimCells || i > order.indexOf(victim))) {
          victim = id;
          victimCells = cells;
        }
      });
      if (victim === null) break;
      eff.set(victim, eff.get(victim) === 'm' ? 'l' : 's');
    }

    // Place largest-first (then newest-first) so halves claim whole rows before
    // quarters fragment the grid.
    const placeOrder = [...order].sort((a, b) => {
      const d = CELL_COUNT[eff.get(b) ?? 's'] - CELL_COUNT[eff.get(a) ?? 's'];
      return d !== 0 ? d : order.indexOf(a) - order.indexOf(b);
    });
    const free: Record<Cell, boolean> = { tl: true, tr: true, bl: true, br: true };
    const take = (...cells: Cell[]): void => cells.forEach((c) => (free[c] = false));
    const out = new Map<WinId, { rect: Rect; size: WinSize }>();
    for (const id of placeOrder) {
      let size = eff.get(id) ?? 's';
      if (size === 'm' && free.tl && free.tr && free.bl && free.br) {
        take('tl', 'tr', 'bl', 'br');
        out.set(id, { rect: geo.full, size });
        continue;
      }
      if (size === 'm') size = 'l';
      if (size === 'l' && free.bl && free.br) {
        take('bl', 'br');
        out.set(id, { rect: geo.rowBottom, size });
        continue;
      }
      if (size === 'l' && free.tl && free.tr) {
        take('tl', 'tr');
        out.set(id, { rect: geo.rowTop, size });
        continue;
      }
      if (size === 'l') size = 's';
      for (const c of ['bl', 'br', 'tl', 'tr'] as Cell[]) {
        if (free[c]) {
          take(c);
          out.set(id, { rect: geo.cell[c], size: 's' });
          break;
        }
      }
    }
    return out;
  }

  function layout(): void {
    const placed = pack();
    const count = order.length;
    order.forEach((id, i) => {
      const frame = frames.get(id);
      const slot = placed.get(id);
      if (frame === undefined || slot === undefined) return;
      const el = frame.el;
      el.style.position = 'fixed';
      el.style.left = `${slot.rect.left}px`;
      el.style.top = `${slot.rect.top}px`;
      el.style.width = `${slot.rect.width}px`;
      el.style.height = `${slot.rect.height}px`;
      // Newest highest, but always below the toolbar (z-index 22).
      el.style.zIndex = String(16 + (count - i));
      markActive(frame, slot.size, count);
    });
  }

  function markActive(frame: Frame, effective: WinSize, count: number): void {
    const disable = (button: HTMLButtonElement, off: boolean): void => {
      button.disabled = off;
      button.classList.toggle('is-disabled', off);
    };
    for (const key of ['s', 'l', 'm'] as WinSize[]) {
      frame.sizeButtons[key].classList.toggle('is-active', key === effective);
    }
    // 100% only fits a lone window; 50% needs two free cells (so up to 3 windows).
    disable(frame.sizeButtons.m, count > 1);
    disable(frame.sizeButtons.l, count > 3);
  }

  return {
    element,
    open: openWindow,
    close: closeWindow,
    toggle: (id): void => {
      if (order.includes(id)) closeWindow(id);
      else openWindow(id);
    },
    closeAll: (): void => {
      for (const id of [...order]) removeFrame(id);
      config.onChange?.();
    },
    isOpen: (id): boolean => order.includes(id),
    openIds: (): WinId[] => [...order],
    relayout: (height): void => {
      toolbarHeight = height;
      layout();
      for (const id of order) config.onResize?.(id);
    },
  };
}
