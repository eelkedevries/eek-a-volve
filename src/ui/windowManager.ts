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

/** Anchor quadrants assigned by open order (design: "newest first"). */
const ANCHORS = ['bl', 'br', 'tl', 'tr'] as const;
type Anchor = (typeof ANCHORS)[number];

/** Up to four windows tile the four corners. */
const MAX_WINDOWS = 4;

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

/** Rectangle for an anchor quadrant at a given size class within the tiling area. */
function sizeRect(area: Rect & { gap: number }, anchor: Anchor, size: WinSize): Rect {
  const halfW = (area.width - area.gap) / 2;
  const halfH = (area.height - area.gap) / 2;
  const leftCol = area.left;
  const rightCol = area.left + halfW + area.gap;
  const topRow = area.top;
  const bottomRow = area.top + halfH + area.gap;

  if (size === 'm') {
    return { left: area.left, top: area.top, width: area.width, height: area.height };
  }
  if (size === 'l') {
    const bottom = anchor === 'bl' || anchor === 'br';
    return { left: area.left, top: bottom ? bottomRow : topRow, width: area.width, height: halfH };
  }
  const left = anchor === 'tl' || anchor === 'bl' ? leftCol : rightCol;
  const top = anchor === 'tl' || anchor === 'tr' ? topRow : bottomRow;
  return { left, top, width: halfW, height: halfH };
}

/**
 * The floating-window manager (design: "Sizing & tiling model"). Owns a layer of
 * uniform window frames that tile into a 2×2 grid by open order (newest →
 * bottom-left, then bottom-right, top-left, top-right), each resizable to a
 * quadrant (25%), a half (50%), or the whole area (100%), or dismissed. No drag.
 * Window body elements are created once by their content components and
 * reparented in and out, so their live `update` methods keep working across
 * open/close. Two small windows tile side by side at every width.
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

  function layout(): void {
    const area = windowArea(toolbarHeight);
    order.forEach((id, i) => {
      const frame = frames.get(id);
      if (frame === undefined) return;
      const anchor = ANCHORS[Math.min(i, ANCHORS.length - 1)];
      const rect = sizeRect(area, anchor, sizes.get(id) ?? 's');
      const el = frame.el;
      el.style.position = 'fixed';
      el.style.left = `${rect.left}px`;
      el.style.top = `${rect.top}px`;
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
      // Newest highest, but always below the toolbar (z-index 22).
      el.style.zIndex = String(16 + (order.length - i));
      markActive(frame);
    });
  }

  function markActive(frame: Frame): void {
    const size = sizes.get(frame.id) ?? 's';
    for (const key of ['s', 'l', 'm'] as WinSize[]) {
      frame.sizeButtons[key].classList.toggle('is-active', key === size);
    }
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
