import type { World } from '../core/world.ts';
import type { SimulationParameters } from '../core/params.ts';
import { SIZE, SPEED, METABOLIC_EFFICIENCY, DISPLAY } from '../core/genome.ts';
import { DISPLAY_COST, MAX_AGE } from '../core/energy.ts';
import { dropCarrion } from '../core/food.ts';
import { computeAgentLayout, type AgentLayout } from '../core/worldLayout.ts';

/**
 * Optional WebAssembly metabolism core (spec v0.4.4, default off). The agent SoA
 * lives in a single shared `WebAssembly.Memory` (see `core/worldLayout.ts`), so the
 * kernel runs the per-tick metabolise/reap pass in place — no per-tick copy — and is
 * bit-for-bit identical to `core/energy.ts` (proven by a full-run equivalence test).
 * The TypeScript core remains the default and the fallback.
 *
 * This is increment 2 of the WASM-core capability: the heavy passes (behaviour,
 * spatial grid) still run in TypeScript over the same shared memory.
 */

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
  /** Run metabolism + reap for every live agent in place; returns the death count. */
  apply(world: World, params: SimulationParameters): number;
}

/** A constructed WASM core: the shared buffer the world is built over, and the kernel. */
export interface WasmCore {
  /** Backing buffer for the agent SoA; pass to `new World(cap, foodCap, sharedBuffer)`. */
  readonly sharedBuffer: ArrayBuffer;
  readonly metabolism: MetabolismKernel;
}

/**
 * Build a WASM core for the given agent capacity from compiled wasm bytes. Allocates
 * one shared memory sized for the agent SoA, instantiates the kernel over it, and
 * returns the buffer (for `World`) plus the in-place metabolism kernel. Throws if
 * instantiation fails (caller falls back to the TS core).
 */
export function createWasmCore(bytes: BufferSource, agentCapacity: number): WasmCore {
  const layout: AgentLayout = computeAgentLayout(agentCapacity);
  const memory = new WebAssembly.Memory({ initial: Math.ceil(layout.byteLength / PAGE) });
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), { env: { memory } });
  const run = instance.exports.run as RunFn;
  const deathView = new Uint8Array(memory.buffer, layout.death, agentCapacity);

  const metabolism: MetabolismKernel = {
    apply(world: World, params: SimulationParameters): number {
      run(
        agentCapacity,
        layout.energy,
        layout.age,
        layout.alive,
        layout.traits[SIZE],
        layout.traits[SPEED],
        layout.traits[METABOLIC_EFFICIENCY],
        layout.traits[DISPLAY],
        layout.death,
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
  };

  return { sharedBuffer: memory.buffer as ArrayBuffer, metabolism };
}
