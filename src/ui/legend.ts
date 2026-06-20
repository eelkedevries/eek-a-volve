import { SPECIES_COLOURS } from '../render/renderer.ts';

const ONBOARDED_KEY = 'eek-a-volve.onboarded';

/** "#rrggbb" from a 0xRRGGBB number. */
function hex(colour: number): string {
  return `#${colour.toString(16).padStart(6, '0')}`;
}

/** A small coloured swatch chip. */
function swatch(colour: number): HTMLElement {
  const s = document.createElement('span');
  s.className = 'legend-swatch';
  s.style.background = hex(colour);
  return s;
}

/** A glyph chip (an emote/symbol) in a given colour. */
function glyph(char: string, colour: number): HTMLElement {
  const s = document.createElement('span');
  s.className = 'legend-glyph';
  s.textContent = char;
  s.style.color = hex(colour);
  return s;
}

/** A legend row: a visual marker followed by an explanation. */
function row(marker: HTMLElement, text: string): HTMLElement {
  const r = document.createElement('div');
  r.className = 'legend-row';
  const desc = document.createElement('span');
  desc.textContent = text;
  r.append(marker, desc);
  return r;
}

function section(title: string, rows: HTMLElement[]): HTMLElement {
  const s = document.createElement('div');
  s.className = 'legend-section';
  const h = document.createElement('h3');
  h.textContent = title;
  s.appendChild(h);
  for (const r of rows) s.appendChild(r);
  return s;
}

export interface Legend {
  element: HTMLElement;
  toggle(): void;
}

/**
 * A dismissible legend (specification: relatability — a shared visual vocabulary).
 * Keys the emotes, body shapes, species colours, and behaviour cues defined by the
 * renderer/effects so "what is that dot doing" becomes "ah, it's hungry and
 * hunting". Toggled from the controls; no simulation impact.
 */
export function createLegend(): Legend {
  const panel = document.createElement('div');
  panel.className = 'legend';
  panel.style.display = 'none';

  const header = document.createElement('div');
  header.className = 'legend-header';
  const title = document.createElement('h2');
  title.textContent = 'Legend';
  const close = document.createElement('button');
  close.className = 'legend-close';
  close.setAttribute('aria-label', 'Close legend');
  close.textContent = '✕';
  close.addEventListener('click', () => {
    panel.style.display = 'none';
  });
  header.append(title, close);
  panel.appendChild(header);

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
      row(glyph('◣', 0x3a0e0e), 'A toothy maw = a carnivore (high diet)'),
      row(glyph('○', 0x9aa7b4), 'A faded, greyer body = starving'),
    ]),
  );

  panel.appendChild(
    section('Food', [
      row(swatch(0x6abf52), 'Green specks are plants'),
      row(swatch(0x9c6b3f), 'Brown specks are carrion (meat)'),
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
    ]),
  );

  const colourRow = document.createElement('div');
  colourRow.className = 'legend-row';
  const swatches = document.createElement('span');
  swatches.className = 'legend-swatches';
  for (const c of SPECIES_COLOURS) swatches.appendChild(swatch(c));
  const colourDesc = document.createElement('span');
  colourDesc.textContent = 'Each colour is a species (a genetic lineage)';
  colourRow.append(swatches, colourDesc);
  panel.appendChild(section('Species colours', [colourRow]));

  return {
    element: panel,
    toggle: (): void => {
      panel.style.display = panel.style.display === 'none' ? '' : 'none';
    },
  };
}

export interface Onboarding {
  element: HTMLElement;
}

/**
 * A one-time welcome hint (remembered in `localStorage`), pointing at the legend
 * and the controls. Shows only on a first visit and is dismissible.
 */
export function createOnboarding(opts: { onOpenLegend: () => void }): Onboarding {
  const element = document.createElement('div');
  element.className = 'onboarding';

  let seen = false;
  try {
    seen = localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    /* private mode etc. — just show it */
  }
  if (seen) {
    element.style.display = 'none';
    return { element };
  }

  const text = document.createElement('p');
  text.textContent =
    'Welcome to eek-a-volve! Creatures eat, hunt, flee, and mate to survive. ' +
    'Click one to meet it, open the Legend to learn the symbols, and use the ' +
    'controls below to pause, change speed, or let the director do the watching.';

  const buttons = document.createElement('div');
  buttons.className = 'onboarding-buttons';

  const dismiss = (): void => {
    try {
      localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      /* ignore */
    }
    element.remove();
  };

  const legendBtn = document.createElement('button');
  legendBtn.textContent = 'Open legend';
  legendBtn.addEventListener('click', () => {
    opts.onOpenLegend();
    dismiss();
  });

  const gotIt = document.createElement('button');
  gotIt.className = 'onboarding-primary';
  gotIt.textContent = 'Got it';
  gotIt.addEventListener('click', dismiss);

  buttons.append(legendBtn, gotIt);
  element.append(text, buttons);
  return { element };
}
