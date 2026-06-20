import type { CreatureDetail } from '../core/inspect.ts';
import { personalName, binomial } from '../humour/names.ts';
import { TRAITS, TRAIT_COUNT, TRAIT_RANGES } from '../core/genome.ts';
import { IDLE, SEEKING, EATING, FLEEING, HUNTING, COURTING } from '../core/state.ts';

const STAGE_LABELS = ['juvenile', 'adult', 'elder'];

const ACTION_VERBS: Record<number, string> = {
  [IDLE]: 'wandering',
  [SEEKING]: 'looking for food',
  [EATING]: 'eating',
  [FLEEING]: 'fleeing for its life',
  [HUNTING]: 'hunting',
  [COURTING]: 'courting',
};

/** Turn a camelCase trait key into a short label. */
function traitLabel(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export interface Inspector {
  element: HTMLElement;
  show(): void;
  hide(): void;
  /** Refresh from a live detail record (called each snapshot while adopted). */
  update(detail: CreatureDetail): void;
}

/**
 * The creature inspector (specification: relatability — protagonists). Shows a
 * clicked creature's procedural name, mock-Latin binomial, traits, age/stage,
 * energy, lineage, and a plain-English action, and offers an Adopt button that
 * follows it with the camera. Driven live by the worker's inspect replies (037).
 */
export function createInspector(opts: { onAdopt: (on: boolean) => void }): Inspector {
  const element = document.createElement('div');
  element.className = 'inspector';
  element.style.display = 'none';

  const name = document.createElement('h2');
  name.className = 'inspector-name';

  const binomialEl = document.createElement('div');
  binomialEl.className = 'inspector-binomial';

  const action = document.createElement('div');
  action.className = 'inspector-action';

  const meta = document.createElement('div');
  meta.className = 'inspector-meta';

  const energyBar = document.createElement('div');
  energyBar.className = 'energy-bar';
  const energyFill = document.createElement('div');
  energyFill.className = 'energy-fill';
  energyBar.appendChild(energyFill);

  const traitList = document.createElement('div');
  traitList.className = 'inspector-traits';
  const traitFills: HTMLElement[] = [];
  const traitValues: HTMLElement[] = [];
  for (let t = 0; t < TRAIT_COUNT; t++) {
    const row = document.createElement('div');
    row.className = 'trait-row';
    const label = document.createElement('span');
    label.className = 'trait-label';
    label.textContent = traitLabel(TRAITS[t]);
    const bar = document.createElement('div');
    bar.className = 'trait-bar';
    const fill = document.createElement('div');
    fill.className = 'trait-fill';
    bar.appendChild(fill);
    const value = document.createElement('span');
    value.className = 'trait-value';
    row.append(label, bar, value);
    traitList.appendChild(row);
    traitFills.push(fill);
    traitValues.push(value);
  }

  let following = false;
  let currentId = -1;
  const adopt = document.createElement('button');
  adopt.className = 'inspector-adopt';
  adopt.textContent = 'Adopt 🐾';
  adopt.addEventListener('click', () => {
    following = !following;
    adopt.textContent = following ? 'Following ✓' : 'Adopt 🐾';
    opts.onAdopt(following);
  });

  element.append(name, binomialEl, action, meta, energyBar, traitList, adopt);

  return {
    element,
    show: (): void => {
      element.style.display = '';
    },
    hide: (): void => {
      element.style.display = 'none';
      if (following) {
        following = false;
        adopt.textContent = 'Adopt 🐾';
      }
    },
    update: (detail: CreatureDetail): void => {
      if (!detail.alive) return;
      if (detail.id !== currentId) {
        // A different creature: reset the adopt toggle.
        currentId = detail.id;
        following = false;
        adopt.textContent = 'Adopt 🐾';
      }
      const who = personalName(detail.id);
      name.textContent = who;
      binomialEl.textContent = binomial(detail.traits);
      action.textContent = `${who} is ${ACTION_VERBS[detail.action] ?? 'pottering about'}.`;
      const stage = STAGE_LABELS[detail.stage] ?? 'adult';
      const offspring = detail.offspringCount === 1 ? '1 offspring' : `${detail.offspringCount} offspring`;
      meta.textContent = `Age ${detail.age} · ${stage} · generation ${detail.generation} · ${offspring}`;
      energyFill.style.width = `${clamp01(detail.energy / detail.energyCapacity) * 100}%`;
      for (let t = 0; t < TRAIT_COUNT; t++) {
        const r = TRAIT_RANGES[t];
        const norm = clamp01((detail.traits[t] - r.min) / (r.max - r.min));
        traitFills[t].style.width = `${norm * 100}%`;
        traitValues[t].textContent = detail.traits[t].toFixed(2);
      }
    },
  };
}
