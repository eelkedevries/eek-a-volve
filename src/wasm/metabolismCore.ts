import type { World } from '../core/world.ts';
import type { Rng } from '../core/rng.ts';
import type { SimulationParameters } from '../core/params.ts';
import { SIZE, SPEED, METABOLIC_EFFICIENCY, DISPLAY } from '../core/genome.ts';
import { DISPLAY_COST, MAX_AGE } from '../core/energy.ts';
import { dropCarrion, PLANT_ENERGY } from '../core/food.ts';
import {
  computeWorldLayout,
  computeGridLayout,
  COUNTS_LENGTH,
  type WorldLayout,
} from '../core/worldLayout.ts';

/**
 * Optional WebAssembly core (spec v0.4.4+, default off). The world SoA lives in a
 * single shared `WebAssembly.Memory` (see `core/worldLayout.ts`), so the kernels run
 * the hot passes in place — no per-tick copy — and are bit-for-bit identical to the
 * TypeScript core (proven by a full-run equivalence test). The TypeScript core
 * remains the default and the fallback.
 *
 * Ported so far: metabolism/reap (060–061) and carrion decay (062). The heavy
 * passes (behaviour, spatial grid) still run in TypeScript over the same memory.
 */

const PAGE = 1 << 16;

type MetaboliseFn = (
  n: number,
  energyOff: number,
  ageOff: number,
  aliveOff: number,
  sizeOff: number,
  speedOff: number,
  effOff: number,
  displayOff: number,
  deathOff: number,
  base: number,
  displayCost: number,
  sexual: number,
  maxAge: number,
) => number;

type DecayFn = (
  n: number,
  aliveOff: number,
  typeOff: number,
  decayOff: number,
  deathOff: number,
) => void;

type RegenFn = (
  rate: number,
  plantCap: number,
  worldW: number,
  worldH: number,
  plantEnergy: number,
  foodXOff: number,
  foodYOff: number,
  foodTypeOff: number,
  foodEnergyOff: number,
  foodDecayOff: number,
  foodAliveOff: number,
  freeFoodOff: number,
  countsOff: number,
) => void;

/** Shared backing arrays for a spatial grid (views over the WASM core's memory). */
export interface GridArrays {
  head: Int32Array;
  next: Int32Array;
  itemX: Float32Array;
  itemY: Float32Array;
}

/** A constructed WASM core: the shared buffer the world is built over, plus passes. */
export interface WasmCore {
  /** Backing buffer for the world SoA; pass to `new World(cap, foodCap, sharedBuffer)`. */
  readonly sharedBuffer: ArrayBuffer;
  /** Shared grid arrays; build `new SpatialGrid(w, h, cell, cap, theseArrays)` over them. */
  readonly agentGridArrays: GridArrays;
  readonly foodGridArrays: GridArrays;
  /** Bind the simulation RNG so WASM passes draw from the same stream. */
  setRng(rng: Rng): void;
  /** Metabolism + reap for every live agent, in place; returns the death count. */
  metabolise(world: World, params: SimulationParameters): number;
  /** Carrion decay; reaps expired carrion via `killFood` in slot order. */
  decayCarrion(world: World): void;
  /** Plant regeneration; returns false for the seasonal/biome cases (caller uses TS). */
  regenerateFood(world: World, params: SimulationParameters): boolean;
}

/**
 * Build a WASM core for the given capacities from compiled wasm bytes. Allocates one
 * shared memory sized for the world SoA, instantiates the kernels over it, and
 * returns the buffer (for `World`) plus the in-place passes. Throws if instantiation
 * fails (caller falls back to the TS core).
 */
export function createWasmCore(
  bytes: BufferSource,
  agentCapacity: number,
  foodCapacity: number,
  worldWidth: number,
  worldHeight: number,
  cellSize: number,
): WasmCore {
  const L: WorldLayout = computeWorldLayout(agentCapacity, foodCapacity);
  const cols = Math.max(1, Math.ceil(worldWidth / cellSize));
  const rows = Math.max(1, Math.ceil(worldHeight / cellSize));
  const gridCells = cols * rows;
  const G = computeGridLayout(L.byteLength, gridCells, agentCapacity, foodCapacity);
  const memory = new WebAssembly.Memory({ initial: Math.ceil(G.byteLength / PAGE) });
  // The RNG is bound per simulation; the imported `rngNext` advances the active stream.
  let activeRng: Rng | null = null;
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
    env: { memory, rngNext: () => (activeRng as Rng).next() },
  });
  const run = instance.exports.run as MetaboliseFn;
  const decay = instance.exports.decay as DecayFn;
  const regen = instance.exports.regenFood as RegenFn;
  const deathView = new Uint8Array(memory.buffer, L.death, agentCapacity);
  const foodDeathView = new Uint8Array(memory.buffer, L.foodDeath, foodCapacity);
  const countsView = new Int32Array(memory.buffer, L.counts, COUNTS_LENGTH);
  const buf = memory.buffer;
  const agentGridArrays: GridArrays = {
    head: new Int32Array(buf, G.agentHead, gridCells),
    next: new Int32Array(buf, G.agentNext, agentCapacity),
    itemX: new Float32Array(buf, G.agentItemX, agentCapacity),
    itemY: new Float32Array(buf, G.agentItemY, agentCapacity),
  };
  const foodGridArrays: GridArrays = {
    head: new Int32Array(buf, G.foodHead, gridCells),
    next: new Int32Array(buf, G.foodNext, foodCapacity),
    itemX: new Float32Array(buf, G.foodItemX, foodCapacity),
    itemY: new Float32Array(buf, G.foodItemY, foodCapacity),
  };

  return {
    sharedBuffer: memory.buffer as ArrayBuffer,
    agentGridArrays,
    foodGridArrays,

    setRng(rng: Rng): void {
      activeRng = rng;
    },

    metabolise(world: World, params: SimulationParameters): number {
      run(
        agentCapacity,
        L.energy,
        L.age,
        L.alive,
        L.traits[SIZE],
        L.traits[SPEED],
        L.traits[METABOLIC_EFFICIENCY],
        L.traits[DISPLAY],
        L.death,
        params.baseMetabolicCost,
        DISPLAY_COST,
        params.sexualReproduction ? 1 : 0,
        MAX_AGE,
      );
      // Reap the marked dead in ascending slot order, matching the TS loop's
      // side-effect order (carrion placement, slot recycling) exactly.
      let deaths = 0;
      for (let s = 0; s < agentCapacity; s++) {
        if (deathView[s] !== 0) {
          dropCarrion(world, world.x[s], world.y[s], world.traits[SIZE][s]);
          world.killAgent(s);
          deaths++;
        }
      }
      return deaths;
    },

    decayCarrion(world: World): void {
      decay(foodCapacity, L.foodAlive, L.foodType, L.foodDecay, L.foodDeath);
      for (let f = 0; f < foodCapacity; f++) {
        if (foodDeathView[f] !== 0) world.killFood(f);
      }
    },

    regenerateFood(world: World, params: SimulationParameters): boolean {
      // The seasonal and biome cases (transcendentals / rejection sampling) stay in
      // TypeScript for now; the host returns false so the caller runs the TS pass.
      if (params.seasonAmplitude > 0 || params.biomeStrength > 0) return false;
      world.writeCounts(countsView);
      regen(
        params.foodRegenRate,
        Math.min(params.foodAbundance, foodCapacity),
        params.worldWidth,
        params.worldHeight,
        PLANT_ENERGY,
        L.foodX,
        L.foodY,
        L.foodType,
        L.foodEnergy,
        L.foodDecay,
        L.foodAlive,
        L.freeFood,
        L.counts,
      );
      world.readCounts(countsView);
      return true;
    },
  };
}
