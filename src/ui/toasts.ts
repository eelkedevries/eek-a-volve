/**
 * A small toast queue for brief, transient messages such as near-extinction
 * warnings (specification: Architecture → `ui/`).
 */
export class Toasts {
  private readonly container: HTMLElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'toasts';
  }

  get element(): HTMLElement {
    return this.container;
  }

  /** Show a message that fades and removes itself after `durationMs`. */
  show(message: string, durationMs = 4000): void {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade');
      setTimeout(() => toast.remove(), 400);
    }, durationMs);
  }
}
