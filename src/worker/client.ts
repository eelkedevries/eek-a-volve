import type { SimulationParameters } from '../core/params.ts';
import type { SimEvent } from '../core/eventlog.ts';
import type { CreatureDetail } from '../core/inspect.ts';
import type { RecordsView } from '../core/records.ts';
import type { MainToWorker, WorkerToMain } from './protocol.ts';

/** Called with each snapshot view and its live-agent count. */
export type SnapshotHandler = (view: Float32Array, count: number) => void;

/** Called with each batch of notable events drained from the worker. */
export type EventsHandler = (events: SimEvent[]) => void;

/** Called with the adopted creature's live detail each frame (or a not-alive record). */
export type InspectHandler = (detail: CreatureDetail) => void;

/** Called with the hall-of-fame records each frame. */
export type RecordsHandler = (records: RecordsView) => void;

/** Called with a pheromone field for the overlay (only while enabled). */
export type FieldHandler = (
  field: Float32Array,
  cols: number,
  rows: number,
  width: number,
  height: number,
) => void;

/**
 * Main-thread handle to the simulation worker. Owns the worker, forwards control
 * messages, and returns each snapshot buffer to the worker after handing it to
 * the handler (the ping-pong half on this side).
 */
export class SimulationClient {
  private readonly worker: Worker;
  private onSnapshot: SnapshotHandler | null = null;
  private onEvents: EventsHandler | null = null;
  private onInspect: InspectHandler | null = null;
  private onRecords: RecordsHandler | null = null;
  private onField: FieldHandler | null = null;

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
      } else if (msg.type === 'inspect') {
        this.onInspect?.(msg.detail);
      } else if (msg.type === 'records') {
        this.onRecords?.(msg.records);
      } else if (msg.type === 'field') {
        this.onField?.(new Float32Array(msg.buffer), msg.cols, msg.rows, msg.width, msg.height);
      }
    };
  }

  /** Register a handler for pheromone-field overlay updates. */
  setFieldHandler(handler: FieldHandler): void {
    this.onField = handler;
  }

  /** Enable/disable the worker posting the pheromone field for the overlay. */
  setOverlay(pheromone: boolean): void {
    this.send({ type: 'setOverlay', pheromone });
  }

  /** Start a run, delivering snapshots, events, adopted-creature detail, and records. */
  start(
    params: SimulationParameters,
    onSnapshot: SnapshotHandler,
    onEvents?: EventsHandler,
    onInspect?: InspectHandler,
    onRecords?: RecordsHandler,
  ): void {
    this.onSnapshot = onSnapshot;
    this.onEvents = onEvents ?? null;
    this.onInspect = onInspect ?? null;
    this.onRecords = onRecords ?? null;
    this.send({ type: 'init', params });
  }

  /** Adopt/inspect a creature by stable id, or -1 to clear. */
  inspect(id: number): void {
    this.send({ type: 'inspect', id });
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
