import type { SimEvent } from '../core/eventlog.ts';
import { personalName } from '../humour/names.ts';
import { catastropheLine } from '../humour/milestones.ts';

/** How many recent lines the log keeps (it scrolls, so it can hold a fair history). */
const MAX_LINES = 80;

/** Round a tick count for readability ("2,140"). */
function ticks(n: number): string {
  return n.toLocaleString('en-GB');
}

/** Turn one event into a line of story in the project's voice, or null to skip it. */
export function feedLine(event: SimEvent): string | null {
  switch (event.kind) {
    case 'freak':
      return `${personalName(event.id)} is born… different. Something in the blood has changed.`;
    case 'catastrophe':
      return catastropheLine({ kind: event.catastrophe, deaths: event.deaths });
    case 'species':
      return `A new lineage strikes out on its own — ${event.count} now share the world.`;
    case 'massDeath':
      return `A wave of dying passes through — ${event.deaths} gone in moments.`;
    case 'nearExtinction':
      return 'The world holds its breath: only a handful remain.';
    case 'obituary': {
      const off = event.offspring === 1 ? '1 offspring' : `${event.offspring} offspring`;
      return `${personalName(event.id)} has died — ${ticks(event.age)} ticks, ${off}. The world turns on.`;
    }
    default:
      return null;
  }
}

export interface Feed {
  element: HTMLElement;
  /** Append events, returning the last line shown (for the narrator), or null. */
  push(events: SimEvent[]): string | null;
  /** Append a plain message (milestones, warnings) under a CSS kind. */
  note(text: string, kind?: string): void;
}

/**
 * The single scrolling message log (specification: Naming and voice). Every
 * notable moment lands here — story events named via {@link personalName}, plus
 * milestones and warnings routed in as plain notes — newest first. This is the
 * only scrollable element in the running UI.
 */
export function createFeed(): Feed {
  const element = document.createElement('div');
  element.className = 'story-feed';

  let last: string | null = null;

  const addLine = (text: string, kind: string): void => {
    const line = document.createElement('div');
    line.className = `feed-line feed-${kind}`;
    line.textContent = text;
    element.prepend(line);
    while (element.childElementCount > MAX_LINES) {
      const oldest = element.lastElementChild;
      if (oldest === null) break;
      oldest.remove();
    }
  };

  return {
    element,
    push: (events): string | null => {
      for (const event of events) {
        const text = feedLine(event);
        if (text === null) continue;
        last = text;
        addLine(text, event.kind);
      }
      return last;
    },
    note: (text, kind = 'note'): void => addLine(text, kind),
  };
}
