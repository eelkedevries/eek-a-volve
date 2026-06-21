export interface ChartSample {
  tick: number;
  population: number;
  species: number;
}

export interface Charts {
  element: HTMLElement;
  /** Record a sample (bounded, downsampled history); redraws if open. */
  push(sample: ChartSample): void;
  /** Tell the chart whether its window is visible, so it only draws when shown. */
  setOpen(open: boolean): void;
  /** Redraw at the current body size (called when the window is resized). */
  resize(): void;
}

/** Bounded number of retained samples, so a multi-day run stays cheap. */
const MAX_SAMPLES = 240;

const POP_COLOUR = '#5cff8f';
const SPECIES_COLOUR = '#54d6ff';

/**
 * The live charts body (design: "Charts"). Plots population (green) and species
 * (cyan) over time from the snapshot aggregates already arriving on the main
 * thread, drawn to a canvas that fills the window and re-renders crisply at the
 * window's current size. Bounded ring of samples; only draws while open.
 */
export function createCharts(): Charts {
  const element = document.createElement('div');
  element.className = 'ev-charts';

  const canvas = document.createElement('canvas');
  canvas.className = 'ev-charts-canvas';
  element.appendChild(canvas);

  const legend = document.createElement('div');
  legend.className = 'ev-charts-legend';
  const key = (colour: string, label: string): void => {
    const item = document.createElement('span');
    item.className = 'ev-charts-key';
    const dash = document.createElement('span');
    dash.className = 'ev-charts-dash';
    dash.style.background = colour;
    item.append(dash, document.createTextNode(label));
    legend.appendChild(item);
  };
  key(POP_COLOUR, 'Population');
  key(SPECIES_COLOUR, 'Species');
  element.appendChild(legend);

  const ticks: number[] = [];
  const pops: number[] = [];
  const specs: number[] = [];
  let open = false;

  function line(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    values: number[],
    max: number,
    colour: string,
  ): void {
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    line(ctx, w, h, pops, Math.max(1, ...pops), POP_COLOUR);
    line(ctx, w, h, specs, Math.max(1, ...specs), SPECIES_COLOUR);
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
      if (o) requestAnimationFrame(draw);
    },
    resize: (): void => {
      if (open) requestAnimationFrame(draw);
    },
  };
}
