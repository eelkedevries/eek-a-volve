import type { CreatureDetail } from '../core/inspect.ts';
import { personalName, binomial } from '../humour/names.ts';
import { TRAITS, TRAIT_COUNT } from '../core/genome.ts';
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
 * The creature inspector (specification: relatability — protagonists). A compact
 * card, shown above the toolbar when a creature is clicked: its procedural name,
 * mock-Latin binomial, age/stage, energy, lineage, a plain-English action, and a
 * wrap of trait chips, plus an Adopt button that follows it with the camera. Kept
 * small so it fits without scrolling; driven live by the worker's inspect replies.
 */
export function createInspector(opts: { onAdopt: (on: boolean) => void }): Inspector {
  const element = document.createElement('div');
  element.className = 'inspector';
  element.style.display = 'none';

  const header = document.createElement('div');
  header.className = 'inspector-header';
  const name = document.createElement('h2');
  name.className = 'inspector-name';
  const binomialEl = document.createElement('span');
  binomialEl.className = 'inspector-binomial';
  header.append(name, binomialEl);

  const action = document.createElement('div');
  action.className = 'inspector-action';

  const meta = document.createElement('div');
  meta.className = 'inspector-meta';

  const lineage = document.createElement('div');
  lineage.className = 'inspector-lineage';
  lineage.style.display = 'none';

  const energyBar = document.createElement('div');
  energyBar.className = 'energy-bar';
  const energyFill = document.createElement('div');
  energyFill.className = 'energy-fill';
  energyBar.appendChild(energyFill);

  const traitList = document.createElement('div');
  traitList.className = 'inspector-traits';
  const traitValues: HTMLElement[] = [];
  for (let t = 0; t < TRAIT_COUNT; t++) {
    const chip = document.createElement('span');
    chip.className = 'trait-chip';
    const label = document.createElement('span');
    label.className = 'trait-chip-label';
    label.textContent = traitLabel(TRAITS[t]);
    const value = document.createElement('span');
    value.className = 'trait-chip-value';
    chip.append(label, value);
    traitList.appendChild(chip);
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

  element.append(header, action, meta, lineage, energyBar, traitList, adopt);

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
      meta.textContent = `Age ${detail.age} · ${stage} · gen ${detail.generation} · ${offspring}`;
      if (detail.ancestry.length > 0) {
        lineage.textContent = `Lineage: ${detail.ancestry.map(personalName).join(' ← ')}`;
        lineage.style.display = '';
      } else {
        lineage.style.display = 'none';
      }
      energyFill.style.width = `${clamp01(detail.energy / detail.energyCapacity) * 100}%`;
      for (let t = 0; t < TRAIT_COUNT; t++) traitValues[t].textContent = detail.traits[t].toFixed(2);
    },
  };
}
