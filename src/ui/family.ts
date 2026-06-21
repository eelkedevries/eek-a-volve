import type { CreatureFamily } from '../core/lineage.ts';
import { personalName } from '../humour/names.ts';

export interface FamilyPanel {
  element: HTMLElement;
  /** Render a creature's bounded family (ancestors above, descendants below). */
  update(family: CreatureFamily): void;
}

/** Up to this many lineage dots are drawn on each tier. */
const MAX_DOTS = 6;

/** A small coloured lineage dot. */
function dot(size: number, colour: string, glow = false): HTMLElement {
  const d = document.createElement('span');
  d.className = 'ev-family-dot';
  d.style.width = d.style.height = `${size}px`;
  d.style.background = colour;
  if (glow) d.style.boxShadow = '0 0 12px rgba(92,255,143,.5)';
  return d;
}

/** A short vertical connector between tiers. */
function connector(): HTMLElement {
  const c = document.createElement('div');
  c.className = 'ev-family-connector';
  return c;
}

/**
 * The lineage body (design: "Family"). A simple ancestors → focus → descendants
 * diagram for the selected creature, with its procedural name and a living-
 * descendants line, built from the bounded family the worker resolves.
 */
export function createFamilyPanel(): FamilyPanel {
  const element = document.createElement('div');
  element.className = 'ev-family';

  const foreCaption = document.createElement('div');
  foreCaption.className = 'ev-family-caption';
  foreCaption.textContent = 'forebears';

  const ancestors = document.createElement('div');
  ancestors.className = 'ev-family-tier';

  const focalWrap = document.createElement('div');
  focalWrap.className = 'ev-family-focal';
  const focalDot = dot(24, 'radial-gradient(circle at 35% 30%, #8dffb0, #2bb869)', true);
  const focalName = document.createElement('span');
  focalName.className = 'ev-family-name';
  focalName.textContent = '—';
  focalWrap.append(focalDot, focalName);

  const descendants = document.createElement('div');
  descendants.className = 'ev-family-tier';

  const descLine = document.createElement('div');
  descLine.className = 'ev-family-desc';
  descLine.textContent = 'select a creature';

  element.append(
    foreCaption,
    ancestors,
    connector(),
    focalWrap,
    connector(),
    descendants,
    descLine,
  );

  const fillTier = (tier: HTMLElement, count: number, size: number, colour: string): void => {
    tier.replaceChildren();
    const n = Math.min(count, MAX_DOTS);
    for (let i = 0; i < n; i++) tier.appendChild(dot(size, colour));
    if (n === 0) {
      const none = document.createElement('span');
      none.className = 'ev-family-none';
      none.textContent = '·';
      tier.appendChild(none);
    }
  };

  return {
    element,
    update: (family): void => {
      focalName.textContent = personalName(family.id);
      fillTier(ancestors, family.ancestry.length, 14, '#5aa37c');
      fillTier(descendants, family.descendants.length, 12, '#7fd0a0');
      const n = family.descendants.length;
      descLine.textContent =
        n === 0 ? 'no living descendants yet' : `${n} living descendant${n === 1 ? '' : 's'}`;
    },
  };
}
