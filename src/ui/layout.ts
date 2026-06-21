/**
 * Shared HUD geometry. The floating-window manager tiles the **world** (the area
 * above the toolbar) using the toolbar's measured height, so the windows always
 * line up just above the one-piece toolbar pinned to the bottom.
 */

/** Safe-area edge inset: 14px desktop, 8px mobile. */
export const EDGE_DESKTOP = 14;
export const EDGE_MOBILE = 8;
/** Gutter between tiled windows, and the gap between the world and the toolbar. */
export const GAP = 8;
/** Below this viewport width the edge inset tightens (still tile, never stack). */
export const MOBILE_BREAKPOINT = 860;

export function edge(): number {
  return window.innerWidth < MOBILE_BREAKPOINT ? EDGE_MOBILE : EDGE_DESKTOP;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The world rectangle the floating windows tile within (above the toolbar). */
export function windowArea(toolbarHeight: number): Rect & { gap: number } {
  const e = edge();
  return {
    left: e,
    top: e,
    width: window.innerWidth - 2 * e,
    height: Math.max(0, window.innerHeight - 2 * e - toolbarHeight - 10),
    gap: GAP,
  };
}
