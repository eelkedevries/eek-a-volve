import type { RecordHolder, RecordsView } from '../core/records.ts';
import { personalName, binomial } from '../humour/names.ts';

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
 * The hall of fame (specification: relatability — stakes and stories). A compact
 * panel of the run's standing records and the reigning Elder, refreshed live from
 * the core {@link RecordsView}.
 */
export function createRecordsPanel(): RecordsPanel {
  const element = document.createElement('details');
  element.className = 'records';
  element.open = true;

  const summary = document.createElement('summary');
  summary.textContent = '🏆 Hall of fame';
  element.appendChild(summary);

  const list = document.createElement('dl');
  list.className = 'records-list';
  element.appendChild(list);

  /** A labelled row whose value element is returned for live updates. */
  const row = (label: string): HTMLElement => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    list.append(dt, dd);
    return dd;
  };

  const elderRow = row('Reigning Elder');
  const oldestRow = row('Oldest ever');
  const biggestRow = row('Largest ever');
  const offspringRow = row('Most offspring');
  const lineageRow = row('Longest bloodline');
  const peakRow = row('Peak population');

  return {
    element,
    update: (r: RecordsView): void => {
      elderRow.textContent = r.reigningElder.alive
        ? `${personalName(r.reigningElder.id)} — ${r.reigningElder.age} ticks`
        : '—';
      oldestRow.textContent =
        r.oldest.id < 0 ? '—' : `${holderName(r.oldest)} — ${r.oldest.value} ticks`;
      biggestRow.textContent =
        r.biggest.id < 0 ? '—' : `${holderName(r.biggest)} — size ${r.biggest.value.toFixed(2)}`;
      offspringRow.textContent =
        r.mostOffspring.id < 0 ? '—' : `${holderName(r.mostOffspring)} — ${r.mostOffspring.value} young`;
      lineageRow.textContent =
        r.longestBloodline.id < 0
          ? '—'
          : `${holderName(r.longestBloodline)} — generation ${r.longestBloodline.value}`;
      peakRow.textContent = `${r.peakPopulation.value} (at tick ${r.peakPopulation.tick})`;
    },
  };
}
