import type { CreatureFamily } from '../core/lineage.ts';
import { personalName } from '../humour/names.ts';

export interface FamilyPanel {
  element: HTMLElement;
  /** Render a creature's bounded family (ancestors above, descendants below). */
  update(family: CreatureFamily): void;
}

/**
 * The adopted creature's local family tree (specification: relatability —
 * lineage). A lightweight, layered view built from the bounded family the worker
 * resolves: ancestors oldest-first across the top, the focal creature in the
 * middle, and its living descendants below — all by procedural name. Shown in a
 * popover while a creature is adopted.
 */
export function createFamilyPanel(): FamilyPanel {
  const element = document.createElement('div');
  element.className = 'family';

  const title = document.createElement('h2');
  title.className = 'family-title';
  title.textContent = 'Family tree';

  const ancestors = document.createElement('div');
  ancestors.className = 'family-ancestors';

  const focal = document.createElement('div');
  focal.className = 'family-focal';

  const descendants = document.createElement('div');
  descendants.className = 'family-descendants';

  const hint = document.createElement('div');
  hint.className = 'family-hint';
  hint.textContent = 'Adopt a creature to see its family.';

  element.append(title, hint, ancestors, focal, descendants);

  return {
    element,
    update: (family): void => {
      hint.style.display = 'none';
      focal.textContent = personalName(family.id);
      ancestors.textContent =
        family.ancestry.length > 0
          ? family.ancestry.slice().reverse().map(personalName).join('  →  ')
          : '(founder — no known ancestors)';
      descendants.textContent =
        family.descendants.length > 0
          ? `Living descendants: ${family.descendants.map(personalName).join(', ')}`
          : '(no living descendants yet)';
    },
  };
}
