import type { SimEvent } from '../core/eventlog.ts';
import { personalName } from '../humour/names.ts';
import { catastropheLine } from '../humour/milestones.ts';

/**
 * Event-kind taxonomy for the story log (design handoff: "Event kind colors").
 * The simulation's {@link SimEvent} kinds and the UI's hand-authored notes both
 * map onto this small set, which drives the accent colour on each log line, the
 * badge in the event-detail window, and nothing in the simulation itself.
 */
export type EventKind =
  | 'spawn'
  | 'death'
  | 'species'
  | 'freak'
  | 'catastrophe'
  | 'milestone'
  | 'record';

/** Accent colour per event kind (design tokens → "Event kind colors"). */
export const EVENT_COLOUR: Record<EventKind, string> = {
  spawn: '#7fe0ff',
  death: '#bcd9c6',
  species: '#5cff8f',
  freak: '#d7a3ff',
  catastrophe: '#ff7d6e',
  milestone: '#5fe3cf',
  record: '#ffd24a',
};

/** One captured moment, with everything the log line and detail window show. */
export interface StoryEvent {
  /** Monotonic id, so list views can key and de-duplicate stably. */
  n: number;
  text: string;
  kind: EventKind;
  /** A longer, plain-English explanation shown in the event-detail window. */
  info: string;
  tick: number;
  /** `mm:ss` sim-clock derived from the tick (60 ticks ≈ one second). */
  clock: string;
  gen: number;
  /** Wall-clock time the moment was recorded. */
  time: string;
}

/** How many recent moments the log retains (design: "Max 60 events retained"). */
const MAX_EVENTS = 60;

/** Round a tick count for readability ("2,140"). */
function ticks(n: number): string {
  return n.toLocaleString('en-GB');
}

/** `mm:ss` sim-clock from a tick count. */
export function formatClock(tick: number): string {
  const total = Math.max(0, Math.floor(tick / 60));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Map one simulation event to a story line + its kind + a longer explanation. */
function describe(event: SimEvent): { text: string; kind: EventKind; info: string } | null {
  switch (event.kind) {
    case 'freak':
      return {
        text: `${personalName(event.id)} is born… different. Something in the blood has changed.`,
        kind: 'freak',
        info: 'A freak mutation pushed a trait to an extreme this lineage has never seen. Whether it is a gift or a burden depends on the soup it was born into.',
      };
    case 'catastrophe':
      return {
        text: catastropheLine({ kind: event.catastrophe, deaths: event.deaths }),
        kind: 'catastrophe',
        info: `A catastrophe swept the world and ${ticks(event.deaths)} creatures were lost. The survivors inherit the emptier, and briefly safer, world that remains.`,
      };
    case 'species':
      return {
        text: `A new lineage strikes out on its own — ${event.count} now share the world.`,
        kind: 'species',
        info: `A group diverged far enough from its ancestors to count as a separate species. ${event.count} species now coexist, each carving out its own way of living.`,
      };
    case 'massDeath':
      return {
        text: `A wave of dying passes through — ${event.deaths} gone in moments.`,
        kind: 'death',
        info: `${ticks(event.deaths)} creatures died in quick succession — starvation, predation, or simple bad luck compounding. Their nutrients return to the world.`,
      };
    case 'plagueDeath':
      return {
        text: `A plague sweeps the crowd — ${event.deaths} succumb to the pox.`,
        kind: 'catastrophe',
        info: `${ticks(event.deaths)} creatures died of disease in quick succession. Dense crowds pay a contagion tax; the survivors are those the sickness spared or that weathered it.`,
      };
    case 'nearExtinction':
      return {
        text: 'The world holds its breath: only a handful remain.',
        kind: 'catastrophe',
        info: 'The population has fallen perilously low. A single good season could spark a recovery; a single bad one could end the run.',
      };
    case 'obituary': {
      const off = event.offspring === 1 ? '1 offspring' : `${event.offspring} offspring`;
      if (event.plague) {
        return {
          text: `${personalName(event.id)} has succumbed to the pox — ${ticks(event.age)} ticks, ${off}. The sickness took them.`,
          kind: 'death',
          info: `A creature the world had been watching died of disease at ${ticks(event.age)} ticks old, leaving ${off}. The contagion frees space and returns nutrients to the living.`,
        };
      }
      return {
        text: `${personalName(event.id)} has died — ${ticks(event.age)} ticks, ${off}. The world turns on.`,
        kind: 'death',
        info: `A creature the world had been watching has died at ${ticks(event.age)} ticks old, leaving ${off}. Death frees space and returns nutrients to the living.`,
      };
    }
    default:
      return null;
  }
}

export interface StoryLog {
  /** Append simulation events, returning the last line added (or null). */
  push(events: SimEvent[]): string | null;
  /** Append a hand-authored note (milestones, warnings) under a kind. */
  note(text: string, kind: EventKind, info?: string): void;
  /** Update the live context stamped onto subsequent events. */
  setContext(tick: number, gen: number): void;
  /** The retained events, oldest-first. */
  getEvents(): StoryEvent[];
  /** Subscribe to changes (a new event arrived); returns an unsubscribe. */
  onChange(handler: () => void): () => void;
}

/**
 * The single source of truth for the story log (design: the Log tab, the
 * maximised Story-log window, and the Event-detail window all read this). A
 * bounded list of {@link StoryEvent}s with live tick/generation context; views
 * subscribe via {@link StoryLog.onChange} and re-read on demand, so the same
 * history is shown everywhere without duplicating state.
 */
export function createStoryLog(): StoryLog {
  const events: StoryEvent[] = [];
  const handlers = new Set<() => void>();
  let counter = 0;
  let tick = 0;
  let gen = 0;

  const emit = (): void => {
    for (const h of handlers) h();
  };

  const add = (text: string, kind: EventKind, info: string, atTick: number): void => {
    events.push({
      n: ++counter,
      text,
      kind,
      info,
      tick: atTick,
      clock: formatClock(atTick),
      gen,
      time: new Date().toLocaleTimeString('en-GB'),
    });
    while (events.length > MAX_EVENTS) events.shift();
  };

  return {
    push: (batch): string | null => {
      let last: string | null = null;
      let changed = false;
      for (const event of batch) {
        const described = describe(event);
        if (described === null) continue;
        add(described.text, described.kind, described.info, event.tick);
        last = described.text;
        changed = true;
      }
      if (changed) emit();
      return last;
    },
    note: (text, kind, info): void => {
      add(text, kind, info ?? text, tick);
      emit();
    },
    setContext: (t, g): void => {
      tick = t;
      gen = g;
    },
    getEvents: (): StoryEvent[] => events,
    onChange: (handler): (() => void) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}
