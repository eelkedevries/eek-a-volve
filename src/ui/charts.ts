export interface ChartSample {
  tick: number;
  population: number;
  species: number;
}

export interface Charts {
  element: HTMLElement;
  /** Record a sample (bounded, downsampled history); redraws if open. */
  push(sample: ChartSample): void;
  /** Tell the chart whether its popover is visible, so it only draws when shown. */
  setOpen(open: boolean): void;
}

/** Bounded number of retained samples, so a multi-day run stays cheap. */
const MAX_SAMPLES = 240;

const POP_COLOUR = '#5cff8f';
const SPECIES_COLOUR = '#54d6ff';

/**
 * A small live charts view (specification: `ui/` — live charts). Plots population
 * and species count over time from the snapshot aggregates already arriving on the
 * main thread, so a long run's adaptation is visible at a glance. Pure main-thread
 * UI: a bounded ring of samples drawn to a 2D canvas, only while the popover is
 * open. No worker or `core/` involvement.
 */
export function createCharts(): Charts {
  const element = document.createElement('div');
  element.className = 'charts';

  const heading = document.createElement('h2');
  heading.className = 'charts-title';
  heading.textContent = 'History';
  element.appendChild(heading);

  const canvas = document.createElement('canvas');
  canvas.className = 'charts-canvas';
  canvas.width = 480;
  canvas.height = 200;
  element.appendChild(canvas);

  const caption = document.createElement('div');
  caption.className = 'charts-caption';
  element.appendChild(caption);

  const ticks: number[] = [];
  const pops: number[] = [];
  const specs: number[] = [];
  let open = false;

  function line(ctx: CanvasRenderingContext2D, values: number[], max: number, colour: string): void {
    const w = canvas.width;
    const h = canvas.height;
    const n = values.length;
    if (n < 2 || max <= 0) return;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * (w - 2) + 1;
      const y = h - 4 - (values[i] / max) * (h - 8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function draw(): void {
    if (!open) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const maxPop = Math.max(1, ...pops);
    const maxSpecies = Math.max(1, ...specs);
    line(ctx, pops, maxPop, POP_COLOUR);
    line(ctx, specs, maxSpecies, SPECIES_COLOUR);
    const lastPop = pops.length > 0 ? pops[pops.length - 1] : 0;
    const lastSpecies = specs.length > 0 ? specs[specs.length - 1] : 0;
    const lastTick = ticks.length > 0 ? ticks[ticks.length - 1] : 0;
    caption.textContent =
      `Tick ${lastTick.toLocaleString('en-GB')} · ` +
      `population ${lastPop.toLocaleString('en-GB')} (peak ${maxPop.toLocaleString('en-GB')}) · ` +
      `${lastSpecies} species`;
  }

  return {
    element,
    push: (sample): void => {
      ticks.push(sample.tick);
      pops.push(sample.population);
      specs.push(sample.species);
      if (ticks.length > MAX_SAMPLES) {
        ticks.shift();
        pops.shift();
        specs.shift();
      }
      draw();
    },
    setOpen: (o): void => {
      open = o;
      if (o) draw();
    },
  };
}
