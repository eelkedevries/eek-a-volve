import type { MainToWorker } from './protocol.ts';
import { createSimulation, type Simulation } from '../core/loop.ts';
import { serialiseSnapshot, snapshotLength } from '../core/snapshot.ts';
import { inspectCreature } from '../core/inspect.ts';
import { MAX_POPULATION } from '../core/bounds.ts';

/** Minimal view of the dedicated-worker global, avoiding DOM/WebWorker lib clashes. */
interface WorkerContext {
  postMessage(message: unknown, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent) => void) | null;
}
const ctx = globalThis as unknown as WorkerContext;

const TARGET_FRAME_MS = 1000 / 60;
/** Hard cap on ticks advanced per posted frame, so a slow machine cannot death-spiral. */
const MAX_TICKS_PER_FRAME = 64;

let sim: Simulation | null = null;
let running = false;
let multiplier = 1;
let accumulator = 0;
let timer: ReturnType<typeof setInterval> | null = null;
/** Stable id of the adopted creature, or -1; replied to each frame while set. */
let adoptedId = -1;
const freeBuffers: ArrayBuffer[] = [];

function frame(): void {
  if (sim === null || !running) return;
  accumulator += multiplier;
  let ticks = Math.floor(accumulator);
  if (ticks > MAX_TICKS_PER_FRAME) ticks = MAX_TICKS_PER_FRAME;
  accumulator -= ticks;
  for (let i = 0; i < ticks; i++) sim.step();

  // Post any notable events drained from the log (cheap; usually empty).
  const events = sim.eventLog.drain();
  if (events.length > 0) ctx.postMessage({ type: 'events', events }, []);

  // Keep the inspector live while a creature is adopted; clear once it has died.
  if (adoptedId !== -1) {
    const detail = inspectCreature(sim, adoptedId);
    ctx.postMessage({ type: 'inspect', detail }, []);
    if (!detail.alive) adoptedId = -1;
  }

  const buffer = freeBuffers.pop();
  if (buffer !== undefined) {
    const count = serialiseSnapshot(sim, new Float32Array(buffer));
    ctx.postMessage({ type: 'snapshot', buffer, count }, [buffer]);
  }
}

ctx.onmessage = (event: MessageEvent): void => {
  const msg = event.data as MainToWorker;
  switch (msg.type) {
    case 'init': {
      sim = createSimulation(msg.params);
      accumulator = 0;
      const bytes =
        snapshotLength(MAX_POPULATION, sim.world.foodCapacity) * Float32Array.BYTES_PER_ELEMENT;
      freeBuffers.length = 0;
      freeBuffers.push(new ArrayBuffer(bytes), new ArrayBuffer(bytes));
      running = true;
      if (timer === null) timer = setInterval(frame, TARGET_FRAME_MS);
      break;
    }
    case 'start':
      running = true;
      break;
    case 'pause':
      running = false;
      break;
    case 'setMultiplier':
      multiplier = msg.multiplier;
      break;
    case 'reset':
      running = false;
      sim = null;
      adoptedId = -1;
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      break;
    case 'inspect':
      adoptedId = msg.id;
      break;
    case 'returnBuffer':
      freeBuffers.push(msg.buffer);
      break;
  }
};
