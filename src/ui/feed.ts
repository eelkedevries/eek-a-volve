import type { SimEvent } from '../core/eventlog.ts';
import { personalName } from '../humour/names.ts';
import { catastropheLine } from '../humour/milestones.ts';

/** How many recent lines the feed keeps on screen. */
const MAX_LINES = 8;

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
}

/**
 * A scrolling "story feed" of recent notable events (specification: Naming and
 * voice). It names individuals via {@link personalName} and reuses the milestone
 * voice, and includes short obituaries when notable creatures pass. The most
 * recent line is returned so the narrator's words can match.
 */
export function createFeed(): Feed {
  const element = document.createElement('div');
  element.className = 'story-feed';

  let last: string | null = null;

  const push = (events: SimEvent[]): string | null => {
    for (const event of events) {
      const text = feedLine(event);
      if (text === null) continue;
      last = text;
      const line = document.createElement('div');
      line.className = `feed-line feed-${event.kind}`;
      line.textContent = text;
      element.prepend(line);
      while (element.childElementCount > MAX_LINES) {
        const oldest = element.lastElementChild;
        if (oldest === null) break;
        oldest.remove();
      }
    }
    return last;
  };

  return { element, push };
}
