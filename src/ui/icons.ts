/**
 * The shared inline-SVG icon set for the UI chrome (design handoff: "all icons
 * are custom inline stroked SVGs — no emoji in the UI chrome"). One small factory
 * builds a sized `<span class="ev-icon">` wrapping a 24×24 viewBox SVG that
 * inherits `currentColor`, so a single component keeps every glyph consistent
 * (1.8–2.2 stroke, round caps/joins). The only emoji that remain live inside
 * story-log message copy, which is intentional flavour text, not chrome.
 */

interface IconDef {
  /** Inner SVG markup (paths/shapes), drawn in a 0 0 24 24 viewBox. */
  body: string;
  /** Filled rather than stroked (play/pause glyphs). */
  filled?: boolean;
  /** Stroke width override (default 1.9). */
  stroke?: number;
}

const ICONS = {
  // Setup — preset cards and behaviour chips
  community: { body: '<circle cx="9" cy="10" r="3"/><circle cx="16" cy="13" r="2.4"/><path d="M3.5 19c.6-2.7 2.8-4 5.5-4s4.9 1.3 5.5 4"/>' },
  swarm: { body: '<path d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>' },
  predation: { body: '<path d="M4 5l3 5 3-5 2 5 3-5 2 5 3-5M5 14h14l-2 5H7z"/>' },
  catastrophe: { body: '<path d="M14 3l-2 7h5l-9 11 2-8H5z"/>' },
  immigration: { body: '<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M9 8V6a3 3 0 016 0v2"/>' },
  sexual: { body: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z"/>' },

  // Control bar
  play: { body: '<path d="M8 5l11 7-11 7z"/>', filled: true },
  pause: { body: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>', filled: true },

  // Toolbar window tabs + Hide/Show UI
  log: { body: '<path d="M5 5h14M5 10h14M5 15h9"/>', stroke: 2 },
  windows: { body: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>', stroke: 2 },
  settings: { body: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8M4.6 9a1.6 1.6 0 00-.3-1.8M9 4.6a1.6 1.6 0 001.8.3M15 19.4a1.6 1.6 0 00-1.8-.3"/>', stroke: 1.8 },
  eye: { body: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' },
  eyeOff: { body: '<path d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.3 3.7M6.5 6.6A17 17 0 002 12s4 6 10 6a9.6 9.6 0 003.3-.6"/>', stroke: 1.8 },

  // Window type icons
  inspector: { body: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>' },
  legend: { body: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>' },
  records: { body: '<path d="M7 4h10v4a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M9 15h6l1 4H8z"/>', stroke: 1.8 },
  charts: { body: '<path d="M4 20V4M20 20H4M8 16l4-5 3 3 4-6"/>' },
  family: { body: '<circle cx="12" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="M12 7.2v4M12 11.2H6v5.6M12 11.2h6v5.6"/>' },
  map: { body: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>' },
  detail: { body: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8.5h.01"/>' },

  // Window controls (sizing)
  sizeSmall: { body: '<rect x="12" y="12" width="8" height="8" rx="1.5"/><rect x="4" y="4" width="16" height="16" rx="2" opacity=".35"/>', stroke: 2 },
  sizeLarge: { body: '<rect x="4" y="12" width="16" height="8" rx="1.5"/><rect x="4" y="4" width="16" height="16" rx="2" opacity=".35"/>', stroke: 2 },
  sizeMax: { body: '<rect x="4" y="4" width="16" height="16" rx="2"/>', stroke: 2 },
  close: { body: '<path d="M6 6l12 12M18 6 6 18"/>', stroke: 2.2 },
  maximise: { body: '<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>', stroke: 2 },

  // Settings tab
  director: { body: '<rect x="3.5" y="9" width="17" height="10.5" rx="1.5"/><path d="m3.8 9 2.6-3.4 3.7 2.9M10.1 8.5 12.7 5l3.7 2.9"/>', stroke: 1.8 },
  sound: { body: '<path d="M5 9v6h4l5 4V5L9 9z"/><path d="M16.5 9.5a3.5 3.5 0 010 5"/>', stroke: 1.8 },
  calm: { body: '<path d="M5 19c0-7 5-12 14-13-1 8-5 13-14 13z"/><path d="M9 15c2-3 5-5 8-6"/>', stroke: 1.8 },
  palette: { body: '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="9.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.5" cy="9.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="10" cy="14.5" r="1.2" fill="currentColor" stroke="none"/>', stroke: 1.8 },
  quality: { body: '<rect x="4" y="14" width="3.4" height="5" rx="1"/><rect x="10.3" y="10" width="3.4" height="9" rx="1"/><rect x="16.6" y="6" width="3.4" height="13" rx="1"/>', stroke: 1.8 },
  reset: { body: '<path d="M20 11A8 8 0 105.7 6.3M20 4v4h-4"/>', stroke: 1.8 },
  closeAll: { body: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="m9 9 6 6M15 9l-6 6"/>', stroke: 1.8 },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

/** Build a sized icon span. `currentColor` flows from the surrounding text colour. */
export function icon(name: IconName, size = 20): HTMLSpanElement {
  const def: IconDef = ICONS[name];
  const span = document.createElement('span');
  span.className = 'ev-icon';
  span.style.width = `${size}px`;
  span.style.height = `${size}px`;
  const paint = def.filled
    ? 'fill="currentColor"'
    : `fill="none" stroke="currentColor" stroke-width="${def.stroke ?? 1.9}" stroke-linecap="round" stroke-linejoin="round"`;
  span.innerHTML = `<svg viewBox="0 0 24 24" ${paint}>${def.body}</svg>`;
  return span;
}
