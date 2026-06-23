import type { World } from '../core/world.ts';
import type { Rng } from '../core/rng.ts';
import type { SimulationParameters } from '../core/params.ts';
import { SIZE, SPEED, METABOLIC_EFFICIENCY, DISPLAY, TRAIT_COUNT, TRAIT_RANGES } from '../core/genome.ts';
import { DISPLAY_COST, MAX_AGE } from '../core/energy.ts';
import { dropCarrion, PLANT_ENERGY, seasonalFactor } from '../core/food.ts';
import { fertilityAt } from '../core/biome.ts';
import {
  computeWorldLayout,
  computeGridLayout,
  COUNTS_LENGTH,
  CONFIG_LENGTH,
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
  biome: number,
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
  /** Plant regeneration (incl. seasonal rate); returns false for biomes (caller uses TS). */
  regenerateFood(world: World, params: SimulationParameters, tick: number): boolean;
  /** Asexual inheritance into `child` from `parent`; returns whether a freak occurred. */
  breed(child: number, parent: number, params: SimulationParameters): boolean;
  /** Sexual inheritance into `child` from parents `a`, `b`; returns whether a freak occurred. */
  breedSexual(child: number, a: number, b: number, params: SimulationParameters): boolean;
  /** Whether the WASM behaviour pass can run (it omits brains for now). */
  canRunBehaviour(params: SimulationParameters): boolean;
  /** Run the behaviour pass in place; returns births. Fills `newborns`/`freakBirths`. */
  behaviourStep(world: World, params: SimulationParameters): number;
  /** Run the predation pass in place (over the freshly-built agent grid); returns deaths. */
  predationStep(world: World): number;
  /** Pheromone-field decay/diffusion in place (when pheromones are on). */
  pheromoneStep(params: SimulationParameters): void;
  /** Shared pheromone field + scratch; build `new PheromoneField(w, h, cell, these)`. */
  readonly pheromoneArrays: { field: Float32Array; scratch: Float32Array };
  readonly newborns: Int32Array;
  readonly freakBirths: Int32Array;
  newbornCount: number;
  freakBirthCount: number;
}

type BehaviourFn = (
  configOff: number,
  cap: number,
  cols: number,
  rows: number,
  cellSize: number,
  worldWidth: number,
  worldHeight: number,
  reproductionThreshold: number,
  sexual: number,
  mutationRate: number,
  mutationMagnitude: number,
  twoPi: number,
  usePheromones: number,
  phCols: number,
  phRows: number,
  phCell: number,
  phDeposit: number,
) => void;

type PheromoneFn = (
  fieldOff: number,
  scratchOff: number,
  cols: number,
  rows: number,
  decay: number,
  diffusion: number,
) => void;

type PredationFn = (
  configOff: number,
  cap: number,
  cols: number,
  rows: number,
  cellSize: number,
) => number;

type BreedFn = (
  child: number,
  parentA: number,
  parentB: number,
  sexual: number,
  mutationRate: number,
  mutationMagnitude: number,
  traitsOff: number,
  cap: number,
  traitCount: number,
  rangesOff: number,
) => number;

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
  pheromoneCellSize: number,
): WasmCore {
  const L: WorldLayout = computeWorldLayout(agentCapacity, foodCapacity);
  const cols = Math.max(1, Math.ceil(worldWidth / cellSize));
  const rows = Math.max(1, Math.ceil(worldHeight / cellSize));
  const gridCells = cols * rows;
  const phCols = Math.max(1, Math.ceil(worldWidth / pheromoneCellSize));
  const phRows = Math.max(1, Math.ceil(worldHeight / pheromoneCellSize));
  const G = computeGridLayout(L.byteLength, gridCells, agentCapacity, foodCapacity, phCols * phRows);
  const memory = new WebAssembly.Memory({ initial: Math.ceil(G.byteLength / PAGE) });
  // The RNG is bound per simulation; the imported `rngNext` advances the active stream.
  let activeRng: Rng | null = null;
  // Biome fertility is host-computed (captures the current world dims + seed) so the
  // WASM regen kernel's rejection sampling stays bit-identical to the TS placement.
  let fertW = 1;
  let fertH = 1;
  let fertSeed = 0;
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
    env: {
      memory,
      rngNext: () => (activeRng as Rng).next(),
      rngInt: (n: number) => (activeRng as Rng).int(n),
      rngGaussian: () => (activeRng as Rng).gaussian(),
      jsCos: (x: number) => Math.cos(x),
      jsSin: (x: number) => Math.sin(x),
      jsFertility: (x: number, y: number) => fertilityAt(x, y, fertW, fertH, fertSeed),
    },
  });
  const pheromoneStepFn = instance.exports.pheromoneStep as PheromoneFn;
  const pheromoneArrays = {
    field: new Float32Array(memory.buffer, G.pheromoneField, phCols * phRows),
    scratch: new Float32Array(memory.buffer, G.pheromoneScratch, phCols * phRows),
  };
  const run = instance.exports.run as MetaboliseFn;
  const decay = instance.exports.decay as DecayFn;
  const regen = instance.exports.regenFood as RegenFn;
  const breedFn = instance.exports.breed as BreedFn;
  const behaviourFn = instance.exports.behaviourStep as BehaviourFn;
  const predationFn = instance.exports.predationStep as PredationFn;
  const deathView = new Uint8Array(memory.buffer, L.death, agentCapacity);
  const foodDeathView = new Uint8Array(memory.buffer, L.foodDeath, foodCapacity);
  const countsView = new Int32Array(memory.buffer, L.counts, COUNTS_LENGTH);
  // Fill the trait-ranges region (f64 [min, max] pairs) from the single source of truth.
  const rangesView = new Float64Array(memory.buffer, G.ranges, TRAIT_COUNT * 2);
  for (let t = 0; t < TRAIT_COUNT; t++) {
    rangesView[t * 2] = TRAIT_RANGES[t].min;
    rangesView[t * 2 + 1] = TRAIT_RANGES[t].max;
  }
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

  // The behaviour kernel reads all column/grid offsets from this config table.
  const config = new Int32Array(buf, G.config, CONFIG_LENGTH);
  const cfg = [
    L.x, L.y, L.vx, L.vy, L.energy, L.age, L.alive, L.action, L.id, L.parentId,
    L.generation, L.offspringCount, L.speciesId, L.traits[0], L.foodX, L.foodY,
    L.foodAlive, L.foodType, L.foodEnergy, G.agentHead, G.agentNext, G.agentItemX,
    G.agentItemY, G.foodHead, G.foodNext, G.foodItemX, G.foodItemY, L.freeAgents,
    L.counts, G.ranges, G.live, G.mated, G.newborns, G.freakBirths, G.outputs,
    G.selfNorm, L.freeFood, G.pheromoneField,
  ];
  config.set(cfg);
  const newbornsView = new Int32Array(buf, G.newborns, agentCapacity);
  const freakBirthsView = new Int32Array(buf, G.freakBirths, agentCapacity);
  const outputsView = new Int32Array(buf, G.outputs, 4);
  const TWO_PI = Math.PI * 2;

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

    regenerateFood(world: World, params: SimulationParameters, tick: number): boolean {
      // Transitions / complexity-state regeneration is region-weighted and has no kernel
      // implementation, so the run falls back to TypeScript food regeneration whenever
      // `transitions` is on (WASM-fallback rule); nothing is placed here.
      if (params.transitions) return false;
      // Seasonal rate is computed here in JS (same `seasonalFactor`); biome fertility
      // is host-computed via the imported `jsFertility` — both keep the kernel
      // bit-identical to the TS placement.
      const rate =
        params.seasonAmplitude > 0
          ? params.foodRegenRate * seasonalFactor(tick, params)
          : params.foodRegenRate;
      fertW = params.worldWidth;
      fertH = params.worldHeight;
      fertSeed = params.seed;
      world.writeCounts(countsView);
      regen(
        rate,
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
        params.biomeStrength,
      );
      world.readCounts(countsView);
      return true;
    },

    breed(child: number, parent: number, params: SimulationParameters): boolean {
      return (
        breedFn(
          child,
          parent,
          parent,
          0,
          params.mutationRate,
          params.mutationMagnitude,
          L.traits[0],
          agentCapacity,
          TRAIT_COUNT,
          G.ranges,
        ) === 1
      );
    },

    breedSexual(child: number, a: number, b: number, params: SimulationParameters): boolean {
      return (
        breedFn(
          child,
          a,
          b,
          1,
          params.mutationRate,
          params.mutationMagnitude,
          L.traits[0],
          agentCapacity,
          TRAIT_COUNT,
          G.ranges,
        ) === 1
      );
    },

    pheromoneArrays,
    newborns: newbornsView,
    freakBirths: freakBirthsView,
    newbornCount: 0,
    freakBirthCount: 0,

    canRunBehaviour(params: SimulationParameters): boolean {
      // Disease, the social-brain return, and culture (social learning) run TS-only
      // (the kernel has no infection, social-foraging, or knowledge logic), so when
      // any is on the whole hot loop falls back to TS, keeping the new
      // columns/feeding advanced and the default WASM path bit-identical
      // (WASM-fallback rule).
      return (
        !params.neuralBrains &&
        params.groupingSafety === 0 &&
        !params.disease &&
        !params.socialBrain &&
        !params.culture
      );
    },

    behaviourStep(world: World, params: SimulationParameters): number {
      world.writeCounts(countsView);
      behaviourFn(
        G.config,
        agentCapacity,
        cols,
        rows,
        cellSize,
        params.worldWidth,
        params.worldHeight,
        params.reproductionThreshold,
        params.sexualReproduction ? 1 : 0,
        params.mutationRate,
        params.mutationMagnitude,
        TWO_PI,
        params.pheromones ? 1 : 0,
        phCols,
        phRows,
        pheromoneCellSize,
        params.pheromoneDeposit,
      );
      world.readCounts(countsView);
      this.newbornCount = outputsView[1];
      this.freakBirthCount = outputsView[2];
      return outputsView[0];
    },

    predationStep(world: World): number {
      world.writeCounts(countsView);
      const deaths = predationFn(G.config, agentCapacity, cols, rows, cellSize);
      world.readCounts(countsView);
      return deaths;
    },

    pheromoneStep(params: SimulationParameters): void {
      pheromoneStepFn(
        G.pheromoneField,
        G.pheromoneScratch,
        phCols,
        phRows,
        params.pheromoneDecay,
        params.pheromoneDiffusion,
      );
    },
  };
}
