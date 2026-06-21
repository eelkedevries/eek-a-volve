import type { MainToWorker } from './protocol.ts';
import { createSimulation, type Simulation } from '../core/loop.ts';
import { serialiseSnapshot, snapshotLength } from '../core/snapshot.ts';
import { inspectCreature } from '../core/inspect.ts';
import { resolveFamily } from '../core/lineage.ts';
import { extractPopulation } from '../core/population.ts';
import { MAX_POPULATION } from '../core/bounds.ts';
import { createMetabolismKernel, type MetabolismKernel } from '../wasm/metabolismCore.ts';
import metabolismWasmUrl from '../wasm/metabolism.wasm?url';

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
/** Whether to post the pheromone field for the overlay, and a throttle counter. */
let postField = false;
let fieldFrame = 0;
const freeBuffers: ArrayBuffer[] = [];
/** Bumped on every init/reset so a slow async wasm load cannot clobber a newer run. */
let initGen = 0;

/** Load the optional WebAssembly metabolism core, or null if off/unsupported/failed. */
async function loadMetabolism(useWasm: boolean): Promise<MetabolismKernel | null> {
  if (!useWasm || typeof WebAssembly === 'undefined') return null;
  try {
    const bytes = await fetch(metabolismWasmUrl).then((r) => r.arrayBuffer());
    return createMetabolismKernel(bytes);
  } catch {
    return null;
  }
}

/** Finish initialising the simulation (after any async wasm load) unless superseded. */
async function setupSim(msg: Extract<MainToWorker, { type: 'init' }>, gen: number): Promise<void> {
  const metabolism = await loadMetabolism(msg.params.wasmCore);
  if (gen !== initGen) return; // a reset/init arrived while we were loading
  sim = createSimulation(msg.params, msg.population, metabolism ?? undefined);
  const bytes = snapshotLength(MAX_POPULATION, sim.world.foodCapacity) * Float32Array.BYTES_PER_ELEMENT;
  freeBuffers.length = 0;
  freeBuffers.push(new ArrayBuffer(bytes), new ArrayBuffer(bytes));
}

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

  // Post the hall-of-fame records (a small, cloned snapshot).
  ctx.postMessage({ type: 'records', records: sim.records.view() }, []);

  // Post the pheromone field for the overlay, throttled, only while enabled.
  if (postField) {
    fieldFrame++;
    if (fieldFrame % 6 === 0) {
      const ph = sim.pheromone;
      const copy = ph.field.slice();
      ctx.postMessage(
        { type: 'field', buffer: copy.buffer, cols: ph.cols, rows: ph.rows, width: sim.params.worldWidth, height: sim.params.worldHeight },
        [copy.buffer],
      );
    }
  }

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
      // Setup may be async (optional wasm core load); frame() no-ops until `sim`
      // is set and buffers exist, so starting the timer now is race-safe.
      sim = null;
      accumulator = 0;
      running = true;
      if (timer === null) timer = setInterval(frame, TARGET_FRAME_MS);
      void setupSim(msg, ++initGen);
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
      initGen++;
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
    case 'setOverlay':
      postField = msg.pheromone;
      break;
    case 'family':
      if (sim !== null) ctx.postMessage({ type: 'family', family: resolveFamily(sim, msg.id) }, []);
      break;
    case 'export':
      if (sim !== null) ctx.postMessage({ type: 'population', save: extractPopulation(sim) }, []);
      break;
    case 'returnBuffer':
      freeBuffers.push(msg.buffer);
      break;
  }
};
