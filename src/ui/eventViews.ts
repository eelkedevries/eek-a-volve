import { EVENT_COLOUR, type StoryEvent } from './storyLog.ts';

export interface EventList {
  element: HTMLElement;
  /** Re-render from the (oldest-first) events; shown newest-first. */
  render(events: StoryEvent[]): void;
}

/**
 * A list of story-log lines (design: the Log tab and the maximised Story-log
 * window). `compact` stacks the message over a `mm:ss · tap for details` caption
 * (the toolbar Log tab); `full` puts the timestamp beside the message (the
 * Story-log window). Each line is a button that opens the Event-detail window.
 */
export function createEventList(
  style: 'compact' | 'full',
  onOpen: (event: StoryEvent) => void,
  /** When set, only the latest N events are shown (the Log tab shows 2). */
  limit?: number,
): EventList {
  const element = document.createElement('div');
  element.className = `ev-eventlist ev-eventlist-${style}`;

  return {
    element,
    render: (events): void => {
      element.replaceChildren();
      const stop = limit != null ? Math.max(0, events.length - limit) : 0;
      for (let i = events.length - 1; i >= stop; i--) {
        const event = events[i];
        const line = document.createElement('button');
        line.type = 'button';
        line.className = 'ev-eventline';
        line.style.borderLeftColor = EVENT_COLOUR[event.kind];
        line.addEventListener('click', () => onOpen(event));

        // Both styles are a timestamp beside the message; CSS sizes them (the
        // compact Log line is single-line with ellipsis; the window line wraps).
        const clock = document.createElement('span');
        clock.className = 'ev-eventline-clock';
        clock.textContent = event.clock;
        const text = document.createElement('span');
        text.className = 'ev-eventline-text';
        text.textContent = event.text;
        line.append(clock, text);
        element.appendChild(line);
      }
    },
  };
}

export interface EventDetail {
  element: HTMLElement;
  /** Show one event's full detail, or a placeholder when null. */
  show(event: StoryEvent | null): void;
}

/**
 * The Event-detail window body (design: "Event-detail"). A coloured kind badge
 * and wall-clock time, the message, a longer explanation, and a three-up grid of
 * sim time, tick, and generation.
 */
export function createEventDetail(): EventDetail {
  const element = document.createElement('div');
  element.className = 'ev-detail';

  const top = document.createElement('div');
  top.className = 'ev-detail-top';
  const badge = document.createElement('span');
  badge.className = 'ev-detail-badge';
  const time = document.createElement('span');
  time.className = 'ev-detail-time';
  top.append(badge, time);

  const message = document.createElement('div');
  message.className = 'ev-detail-message';

  const info = document.createElement('p');
  info.className = 'ev-detail-info';

  const grid = document.createElement('div');
  grid.className = 'ev-detail-grid';
  const cell = (label: string): HTMLElement => {
    const wrap = document.createElement('div');
    wrap.className = 'ev-detail-cell';
    const l = document.createElement('div');
    l.className = 'ev-detail-cell-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = 'ev-detail-cell-value';
    v.textContent = '—';
    wrap.append(l, v);
    grid.appendChild(wrap);
    return v;
  };
  const simTime = cell('Sim time');
  const tick = cell('Tick');
  const gen = cell('Gen');

  element.append(top, message, info, grid);

  return {
    element,
    show: (event): void => {
      if (event === null) {
        badge.textContent = '';
        badge.style.color = '#9bc1aa';
        time.textContent = '';
        message.textContent = 'No event selected';
        info.textContent = 'Tap a line in the story log to see its details.';
        simTime.textContent = tick.textContent = gen.textContent = '—';
        return;
      }
      badge.textContent = event.kind.toUpperCase();
      badge.style.color = EVENT_COLOUR[event.kind];
      time.textContent = event.time;
      message.textContent = event.text;
      info.textContent = event.info;
      simTime.textContent = event.clock;
      tick.textContent = event.tick.toLocaleString('en-GB');
      gen.textContent = String(event.gen);
    },
  };
}
