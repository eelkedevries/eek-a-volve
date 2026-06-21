import type { RecordHolder, RecordsView } from '../core/records.ts';
import { personalName, binomial } from '../humour/names.ts';
import { icon } from './icons.ts';

export interface RecordsPanel {
  element: HTMLElement;
  update(records: RecordsView): void;
}

/** "Name (Binomial)" for a holder, or a dash if there is no holder yet. */
function holderName(h: RecordHolder): string {
  if (h.id < 0) return '—';
  return `${personalName(h.id)} (${binomial(h.traits)})`;
}

/**
 * The hall-of-fame body (design: "Records"). A list of trophy rows — title, who
 * holds it, and the standing value — refreshed live from the core
 * {@link RecordsView}. All-time records survive their holders' deaths.
 */
export function createRecordsPanel(): RecordsPanel {
  const element = document.createElement('div');
  element.className = 'ev-records';

  /** A trophy row whose who/value elements are returned for live updates. */
  const row = (title: string): { who: HTMLElement; value: HTMLElement } => {
    const wrap = document.createElement('div');
    wrap.className = 'ev-record';
    const trophy = icon('records', 20);
    trophy.classList.add('ev-record-trophy');
    const text = document.createElement('div');
    text.className = 'ev-record-text';
    const t = document.createElement('div');
    t.className = 'ev-record-title';
    t.textContent = title;
    const who = document.createElement('div');
    who.className = 'ev-record-who';
    who.textContent = '—';
    text.append(t, who);
    const value = document.createElement('div');
    value.className = 'ev-record-value';
    value.textContent = '—';
    wrap.append(trophy, text, value);
    element.appendChild(wrap);
    return { who, value };
  };

  const elder = row('Reigning Elder');
  const oldest = row('Oldest ever');
  const biggest = row('Largest ever');
  const offspring = row('Most offspring');
  const bloodline = row('Longest bloodline');
  const peak = row('Peak population');

  const set = (
    target: { who: HTMLElement; value: HTMLElement },
    who: string,
    value: string,
  ): void => {
    target.who.textContent = who;
    target.value.textContent = value;
  };

  return {
    element,
    update: (r: RecordsView): void => {
      set(
        elder,
        r.reigningElder.alive ? personalName(r.reigningElder.id) : '—',
        r.reigningElder.alive ? `${r.reigningElder.age.toLocaleString('en-GB')}` : '—',
      );
      set(oldest, holderName(r.oldest), r.oldest.id < 0 ? '—' : r.oldest.value.toLocaleString('en-GB'));
      set(biggest, holderName(r.biggest), r.biggest.id < 0 ? '—' : `${r.biggest.value.toFixed(2)}×`);
      set(
        offspring,
        holderName(r.mostOffspring),
        r.mostOffspring.id < 0 ? '—' : String(r.mostOffspring.value),
      );
      set(
        bloodline,
        holderName(r.longestBloodline),
        r.longestBloodline.id < 0 ? '—' : `gen ${r.longestBloodline.value}`,
      );
      set(peak, `at tick ${r.peakPopulation.tick.toLocaleString('en-GB')}`, String(r.peakPopulation.value));
    },
  };
}
