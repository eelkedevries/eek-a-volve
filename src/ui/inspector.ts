import type { CreatureDetail } from '../core/inspect.ts';
import { personalName, binomial } from '../humour/names.ts';
import { SIZE, SPEED, SENSE_RADIUS, DIET, COLOUR_HUE } from '../core/genome.ts';
import { IDLE, SEEKING, EATING, FLEEING, HUNTING, COURTING } from '../core/state.ts';

const ACTION_VERBS: Record<number, string> = {
  [IDLE]: 'wandering',
  [SEEKING]: 'looking for food',
  [EATING]: 'eating',
  [FLEEING]: 'fleeing for its life',
  [HUNTING]: 'hunting',
  [COURTING]: 'courting',
};

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export interface Inspector {
  element: HTMLElement;
  /** Refresh from a live detail record (driven by the worker's inspect replies). */
  update(detail: CreatureDetail): void;
  /** Clear the adopt/follow state (called when the inspector window closes). */
  reset(): void;
}

/**
 * The creature inspector body (design: "Inspector"). Shown in a floating window
 * when a creature is tapped: its procedural name and mock-Latin binomial, a
 * plain-English action, a gen/age/offspring meta line, an energy bar, a 3×2 grid
 * of traits, and an Adopt toggle that follows it with the camera. Bound live to
 * the actual creature record from the sim (read-only).
 */
export function createInspector(opts: { onAdopt: (on: boolean) => void }): Inspector {
  const element = document.createElement('div');
  element.className = 'ev-inspector';

  const header = document.createElement('div');
  header.className = 'ev-inspector-header';
  const name = document.createElement('span');
  name.className = 'ev-inspector-name';
  name.textContent = '—';
  const binomialEl = document.createElement('span');
  binomialEl.className = 'ev-inspector-binomial';
  binomialEl.textContent = '—';
  header.append(name, binomialEl);

  const action = document.createElement('div');
  action.className = 'ev-inspector-action';
  action.textContent = '—';

  const meta = document.createElement('div');
  meta.className = 'ev-inspector-meta';
  meta.textContent = '—';

  const energyWrap = document.createElement('div');
  energyWrap.className = 'ev-inspector-energy';
  const energyTag = document.createElement('span');
  energyTag.className = 'ev-inspector-energy-tag';
  energyTag.textContent = 'energy';
  const energyBar = document.createElement('div');
  energyBar.className = 'ev-energy-bar';
  const energyFill = document.createElement('div');
  energyFill.className = 'ev-energy-fill';
  energyBar.appendChild(energyFill);
  energyWrap.append(energyTag, energyBar);

  const grid = document.createElement('div');
  grid.className = 'ev-inspector-grid';
  const statCell = (label: string): HTMLElement => {
    const wrap = document.createElement('div');
    wrap.className = 'ev-inspector-stat';
    const l = document.createElement('div');
    l.className = 'ev-inspector-stat-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = 'ev-inspector-stat-value';
    v.textContent = '—';
    wrap.append(l, v);
    grid.appendChild(wrap);
    return v;
  };
  const sizeCell = statCell('Size');
  const speedCell = statCell('Speed');
  const senseCell = statCell('Sense');
  const dietCell = statCell('Diet');
  const ageCell = statCell('Age');
  const hueCell = statCell('Hue');

  let following = false;
  let currentId = -1;
  const adopt = document.createElement('button');
  adopt.type = 'button';
  adopt.className = 'ev-adopt';
  const adoptLabel = (): string => (following ? '★ Adopted — following' : '☆ Adopt this creature');
  adopt.textContent = adoptLabel();
  const syncAdopt = (): void => {
    adopt.textContent = adoptLabel();
    adopt.classList.toggle('is-following', following);
  };
  adopt.addEventListener('click', () => {
    following = !following;
    syncAdopt();
    opts.onAdopt(following);
  });

  element.append(header, action, meta, energyWrap, grid, adopt);

  return {
    element,
    update: (detail: CreatureDetail): void => {
      if (!detail.alive) return;
      if (detail.id !== currentId) {
        currentId = detail.id;
        following = false;
        syncAdopt();
      }
      const who = personalName(detail.id);
      name.textContent = who;
      binomialEl.textContent = binomial(detail.traits);
      action.textContent = `Currently ${ACTION_VERBS[detail.action] ?? 'pottering about'}`;
      const offspring =
        detail.offspringCount === 1 ? '1 offspring' : `${detail.offspringCount} offspring`;
      meta.textContent = `gen ${detail.generation} · age ${detail.age} · ${offspring}`;
      energyFill.style.width = `${clamp01(detail.energy / detail.energyCapacity) * 100}%`;
      sizeCell.textContent = detail.traits[SIZE].toFixed(2);
      speedCell.textContent = detail.traits[SPEED].toFixed(2);
      senseCell.textContent = String(Math.round(detail.traits[SENSE_RADIUS]));
      dietCell.textContent = detail.traits[DIET] > 0.5 ? 'carnivore' : 'herbivore';
      ageCell.textContent = String(detail.age);
      hueCell.textContent = `${Math.round(detail.traits[COLOUR_HUE])}°`;
    },
    reset: (): void => {
      currentId = -1;
      if (following) {
        following = false;
        syncAdopt();
      }
    },
  };
}
