import type { SimulationParameters } from '../core/params.ts';
import type { SimEvent } from '../core/eventlog.ts';

/** Messages from the main thread to the simulation worker. */
export type MainToWorker =
  | { type: 'init'; params: SimulationParameters }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'setMultiplier'; multiplier: number }
  | { type: 'reset' }
  | { type: 'returnBuffer'; buffer: ArrayBuffer };

/** Messages from the worker to the main thread. */
export type WorkerToMain =
  | { type: 'snapshot'; buffer: ArrayBuffer; count: number }
  | { type: 'events'; events: SimEvent[] };
