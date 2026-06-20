import type { SimulationParameters } from '../core/params.ts';
import type { SimEvent } from '../core/eventlog.ts';
import type { CreatureDetail } from '../core/inspect.ts';
import type { CreatureFamily } from '../core/lineage.ts';
import type { PopulationRecord, PopulationSave } from '../core/population.ts';
import type { RecordsView } from '../core/records.ts';

/** Messages from the main thread to the simulation worker. */
export type MainToWorker =
  | { type: 'init'; params: SimulationParameters; population?: PopulationRecord[] }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'setMultiplier'; multiplier: number }
  | { type: 'reset' }
  | { type: 'returnBuffer'; buffer: ArrayBuffer }
  // Adopt/inspect a creature by stable id (slots recycle, so never by slot); -1 clears.
  | { type: 'inspect'; id: number }
  // Enable/disable posting the pheromone field for the render overlay.
  | { type: 'setOverlay'; pheromone: boolean }
  // Request the bounded family (ancestors + living descendants) of a creature.
  | { type: 'family'; id: number }
  // Request the current population for export/download.
  | { type: 'export' };

/** Messages from the worker to the main thread. */
export type WorkerToMain =
  | { type: 'snapshot'; buffer: ArrayBuffer; count: number }
  | { type: 'events'; events: SimEvent[] }
  | { type: 'inspect'; detail: CreatureDetail }
  | { type: 'records'; records: RecordsView }
  // A downsampled pheromone field for the overlay (only while enabled).
  | { type: 'field'; buffer: ArrayBuffer; cols: number; rows: number; width: number; height: number }
  // The bounded family of a requested creature.
  | { type: 'family'; family: CreatureFamily }
  // The current population, in reply to an export request.
  | { type: 'population'; save: PopulationSave };
