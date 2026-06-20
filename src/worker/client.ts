import type { SimulationParameters } from '../core/params.ts';
import type { SimEvent } from '../core/eventlog.ts';
import type { MainToWorker, WorkerToMain } from './protocol.ts';

/** Called with each snapshot view and its live-agent count. */
export type SnapshotHandler = (view: Float32Array, count: number) => void;

/** Called with each batch of notable events drained from the worker. */
export type EventsHandler = (events: SimEvent[]) => void;

/**
 * Main-thread handle to the simulation worker. Owns the worker, forwards control
 * messages, and returns each snapshot buffer to the worker after handing it to
 * the handler (the ping-pong half on this side).
 */
export class SimulationClient {
  private readonly worker: Worker;
  private onSnapshot: SnapshotHandler | null = null;
  private onEvents: EventsHandler | null = null;

  constructor() {
    this.worker = new Worker(new URL('./simulationWorker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<WorkerToMain>): void => {
      const msg = event.data;
      if (msg.type === 'snapshot') {
        this.onSnapshot?.(new Float32Array(msg.buffer), msg.count);
        this.send({ type: 'returnBuffer', buffer: msg.buffer }, [msg.buffer]);
      } else if (msg.type === 'events') {
        this.onEvents?.(msg.events);
      }
    };
  }

  /** Start a run, delivering snapshots to `onSnapshot` and notable events to `onEvents`. */
  start(params: SimulationParameters, onSnapshot: SnapshotHandler, onEvents?: EventsHandler): void {
    this.onSnapshot = onSnapshot;
    this.onEvents = onEvents ?? null;
    this.send({ type: 'init', params });
  }

  pause(): void {
    this.send({ type: 'pause' });
  }

  resume(): void {
    this.send({ type: 'start' });
  }

  setMultiplier(multiplier: number): void {
    this.send({ type: 'setMultiplier', multiplier });
  }

  reset(): void {
    this.send({ type: 'reset' });
  }

  dispose(): void {
    this.worker.terminate();
  }

  private send(message: MainToWorker, transfer: Transferable[] = []): void {
    this.worker.postMessage(message, transfer);
  }
}
