/**
 * Shared HUD geometry (design handoff: "Layout model" + "Spacing"). The window
 * manager and the toolbar ("message") window both derive their fixed positions
 * from these constants, so the floating-window tiling area always lines up
 * exactly above the control bar and beside the toolbar window.
 */

/** Control bar height (px). */
export const BAR_H = 58;
/** Safe-area edge inset: 14px desktop, 8px mobile. */
export const EDGE_DESKTOP = 14;
export const EDGE_MOBILE = 8;
/** Toolbar ("message") window size — desktop is fixed; mobile spans the width. */
export const PANEL_DESK_W = 322;
export const PANEL_DESK_H = 300;
export const PANEL_MOBILE_H = 230;
/** Gutter between tiled windows. */
export const GAP = 8;
/** Below this viewport width the HUD switches to its portrait stack. */
export const MOBILE_BREAKPOINT = 860;

export function edge(mobile: boolean): number {
  return mobile ? EDGE_MOBILE : EDGE_DESKTOP;
}

/** Distance from the viewport bottom to the toolbar window's lower edge. */
export function toolbarWindowBottom(mobile: boolean): number {
  return BAR_H + edge(mobile) + 10;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The rectangle the floating windows tile within (above the control bar). */
export function windowArea(mobile: boolean): Rect & { gap: number } {
  const e = edge(mobile);
  return {
    left: e,
    top: e,
    width: window.innerWidth - 2 * e,
    height: window.innerHeight - 3 * e - (BAR_H + 10),
    gap: GAP,
  };
}
