import type { World } from '../core/world.ts';
import type { SimulationParameters } from '../core/params.ts';
import { SIZE, SPEED, METABOLIC_EFFICIENCY, DISPLAY } from '../core/genome.ts';
import { DISPLAY_COST, MAX_AGE } from '../core/energy.ts';
import { dropCarrion } from '../core/food.ts';

/**
 * Optional WebAssembly metabolism core (spec v0.4.3, default off). Instantiates
 * the compiled `metabolism.wasm` kernel and drives the per-tick metabolise/reap
 * pass through it instead of `core/energy.ts`. The kernel is bit-for-bit identical
 * to the TypeScript pass (see `metabolism.as.ts`), so a run with the WASM core
 * matches the default run exactly; the TS core remains the default and fallback.
 *
 * This is the first increment of the WASM-core capability: the heavy passes
 * (behaviour, spatial grid) still run in TypeScript, and the WASM core marshals
 * columns in and out each tick — so it is a verified, equivalent foundation rather
 * than a performance win yet (that needs the heavy passes ported and shared memory).
 */

/** Agent columns start here; AssemblyScript's stack/static data live below this. */
const DATA_BASE = 1 << 16;
const PAGE = 1 << 16;

type RunFn = (
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

export interface MetabolismKernel {
  /** Run metabolism + reap for every live agent; returns the death count. */
  apply(world: World, params: SimulationParameters): number;
}

/** Build a metabolism kernel from compiled wasm bytes, or throw if instantiation fails. */
export function createMetabolismKernel(bytes: BufferSource): MetabolismKernel {
  const memory = new WebAssembly.Memory({ initial: 8 });
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), { env: { memory } });
  const run = instance.exports.run as RunFn;

  let cap = -1;
  let energyOff = 0;
  let ageOff = 0;
  let aliveOff = 0;
  let sizeOff = 0;
  let speedOff = 0;
  let effOff = 0;
  let displayOff = 0;
  let deathOff = 0;
  let energyV!: Float32Array;
  let ageV!: Uint32Array;
  let aliveV!: Int32Array;
  let sizeV!: Float32Array;
  let speedV!: Float32Array;
  let effV!: Float32Array;
  let displayV!: Float32Array;
  let deathV!: Int32Array;

  function setup(n: number): void {
    cap = n;
    const end = DATA_BASE + cap * 32;
    if (memory.buffer.byteLength < end) {
      memory.grow(Math.ceil((end - memory.buffer.byteLength) / PAGE));
    }
    energyOff = DATA_BASE;
    ageOff = DATA_BASE + cap * 4;
    aliveOff = DATA_BASE + cap * 8;
    sizeOff = DATA_BASE + cap * 12;
    speedOff = DATA_BASE + cap * 16;
    effOff = DATA_BASE + cap * 20;
    displayOff = DATA_BASE + cap * 24;
    deathOff = DATA_BASE + cap * 28;
    const buf = memory.buffer;
    energyV = new Float32Array(buf, energyOff, cap);
    ageV = new Uint32Array(buf, ageOff, cap);
    aliveV = new Int32Array(buf, aliveOff, cap);
    sizeV = new Float32Array(buf, sizeOff, cap);
    speedV = new Float32Array(buf, speedOff, cap);
    effV = new Float32Array(buf, effOff, cap);
    displayV = new Float32Array(buf, displayOff, cap);
    deathV = new Int32Array(buf, deathOff, cap);
  }

  return {
    apply(world: World, params: SimulationParameters): number {
      const n = world.agentCapacity;
      if (n !== cap) setup(n);

      // Marshal the columns the kernel reads into linear memory.
      energyV.set(world.energy);
      ageV.set(world.age);
      aliveV.set(world.alive);
      sizeV.set(world.traits[SIZE]);
      speedV.set(world.traits[SPEED]);
      effV.set(world.traits[METABOLIC_EFFICIENCY]);
      displayV.set(world.traits[DISPLAY]);

      run(
        n,
        energyOff,
        ageOff,
        aliveOff,
        sizeOff,
        speedOff,
        effOff,
        displayOff,
        deathOff,
        params.baseMetabolicCost,
        DISPLAY_COST,
        params.sexualReproduction ? 1 : 0,
        MAX_AGE,
      );

      // Read the mutated columns back.
      world.energy.set(energyV);
      world.age.set(ageV);

      // Reap the marked dead in ascending slot order, matching the TS loop's
      // side-effect order (carrion placement, slot recycling) exactly.
      let deaths = 0;
      for (let s = 0; s < n; s++) {
        if (deathV[s] !== 0) {
          dropCarrion(world, world.x[s], world.y[s], world.traits[SIZE][s]);
          world.killAgent(s);
          deaths++;
        }
      }
      return deaths;
    },
  };
}
