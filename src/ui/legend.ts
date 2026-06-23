import { SPECIES_COLOURS } from '../render/renderer.ts';

/** "#rrggbb" from a 0xRRGGBB number. */
function hex(colour: number): string {
  return `#${colour.toString(16).padStart(6, '0')}`;
}

/** A small coloured swatch chip. */
function swatch(colour: number): HTMLElement {
  const s = document.createElement('span');
  s.className = 'ev-legend-swatch';
  s.style.background = hex(colour);
  return s;
}

/** A glyph chip (an emote/symbol) in a given colour. */
function glyph(char: string, colour: number): HTMLElement {
  const s = document.createElement('span');
  s.className = 'ev-legend-glyph';
  s.textContent = char;
  s.style.color = hex(colour);
  return s;
}

/** A legend row: a visual marker followed by an explanation. */
function row(marker: HTMLElement, text: string): HTMLElement {
  const r = document.createElement('div');
  r.className = 'ev-legend-row';
  const desc = document.createElement('span');
  desc.innerHTML = text;
  r.append(marker, desc);
  return r;
}

/** A big radial-gradient dot for the headline rows. */
function bigDot(gradient: string): HTMLElement {
  const d = document.createElement('span');
  d.className = 'ev-legend-bigdot';
  d.style.background = gradient;
  return d;
}

function section(title: string, rows: HTMLElement[]): HTMLElement {
  const s = document.createElement('div');
  s.className = 'ev-legend-section';
  const h = document.createElement('h3');
  h.textContent = title;
  s.appendChild(h);
  for (const r of rows) s.appendChild(r);
  return s;
}

export interface Legend {
  element: HTMLElement;
}

/**
 * The legend body (design: "Legend"). Headline rows for Creatures / Food /
 * Carnivores, then the detailed visual vocabulary the renderer actually draws —
 * moods, body shapes, food, event cues, and species colours — so "what is that
 * dot doing" becomes legible. Content exceeds the small window size, so it
 * scrolls. No simulation impact.
 */
export function createLegend(): Legend {
  const panel = document.createElement('div');
  panel.className = 'ev-legend';

  panel.append(
    row(
      bigDot('radial-gradient(circle at 35% 30%, #8dffb0, #2bb869)'),
      '<b>Creatures</b> wander, graze and breed. Colour is a genetic hue — kin look alike.',
    ),
    row(
      bigDot('radial-gradient(circle at 35% 30%, #ffd24a, #d98a17)'),
      '<b>Food</b> glimmers across the world. Eat, fill the bar, reproduce.',
    ),
    row(
      bigDot('radial-gradient(circle at 35% 30%, #ff9d80, #d9442a)'),
      '<b>Carnivores</b> (warm hues, sharp eyes) hunt. Herbivores graze in peace.',
    ),
  );

  panel.appendChild(
    section('Moods', [
      row(glyph('…', 0xe9e2c0), 'Hungry — low on energy'),
      row(glyph('!', 0xff6a6a), 'Scared — fleeing a predator'),
      row(glyph('♥', 0xff8fc4), 'Amorous — courting a mate'),
      row(glyph('♚', 0xffd24a), 'A crown marks an Elder (old age)'),
    ]),
  );

  panel.appendChild(
    section('Bodies', [
      row(glyph('●', 0xcdd9e5), 'Bigger, rounder body = larger size'),
      row(glyph('◉', 0xcdd9e5), 'Bigger eyes = a wider sense radius'),
      row(glyph('◣', 0xff9d80), 'A toothy maw = a carnivore (high diet)'),
      row(glyph('○', 0x9aa7b4), 'A faded, greyer body = starving'),
      row(glyph('●', 0x8fbf4a), 'A sickly green cast = infected (when disease is on)'),
    ]),
  );

  panel.appendChild(
    section('What just happened', [
      row(swatch(0xffe08a), 'Munch ring + crumbs — eating'),
      row(swatch(0xff5247), 'Red flash + splat — a hunt kill'),
      row(swatch(0x7fe3ff), 'A quick dart — fleeing'),
      row(glyph('♥', 0xff8fc4), 'Heart sparkle — a pair mates'),
      row(swatch(0xbfffd0), 'Green pop + thread — a birth (parent → child)'),
      row(swatch(0x9aa7b4), 'Grey puff — a death'),
      row(swatch(0x8fbf4a), 'A green pall over many — a plague die-off'),
    ]),
  );

  const colourRow = document.createElement('div');
  colourRow.className = 'ev-legend-row';
  const swatches = document.createElement('span');
  swatches.className = 'ev-legend-swatches';
  for (const c of SPECIES_COLOURS) swatches.appendChild(swatch(c));
  const colourDesc = document.createElement('span');
  colourDesc.textContent = 'Each colour is a species (a genetic lineage)';
  colourRow.append(swatches, colourDesc);
  panel.appendChild(section('Species colours', [colourRow]));

  return { element: panel };
}
