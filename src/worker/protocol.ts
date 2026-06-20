import type { SimulationParameters } from '../core/params.ts';
import type { SimEvent } from '../core/eventlog.ts';
import type { CreatureDetail } from '../core/inspect.ts';
import type { RecordsView } from '../core/records.ts';

/** Messages from the main thread to the simulation worker. */
export type MainToWorker =
  | { type: 'init'; params: SimulationParameters }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'setMultiplier'; multiplier: number }
  | { type: 'reset' }
  | { type: 'returnBuffer'; buffer: ArrayBuffer }
  // Adopt/inspect a creature by stable id (slots recycle, so never by slot); -1 clears.
  | { type: 'inspect'; id: number };

/** Messages from the worker to the main thread. */
export type WorkerToMain =
  | { type: 'snapshot'; buffer: ArrayBuffer; count: number }
  | { type: 'events'; events: SimEvent[] }
  | { type: 'inspect'; detail: CreatureDetail }
  | { type: 'records'; records: RecordsView };
