/**
 * A small rolling line chart of population over time, drawn on a `<canvas>` from
 * snapshot headers (specification: Architecture → `ui/`). No charting library.
 */
export class PopulationChart {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly history: number[] = [];
  private readonly maxPoints = 360;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'chart';
    this.canvas.width = 240;
    this.canvas.height = 80;
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  /** Append a population reading and redraw. */
  push(population: number): void {
    this.history.push(population);
    if (this.history.length > this.maxPoints) this.history.shift();
    this.draw();
  }

  private draw(): void {
    const { ctx, canvas, history } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (history.length < 2) return;
    let max = 1;
    for (const v of history) if (v > max) max = v;
    ctx.strokeStyle = '#5dff7a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const x = (i / (this.maxPoints - 1)) * canvas.width;
      const y = canvas.height - (history[i] / max) * (canvas.height - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
