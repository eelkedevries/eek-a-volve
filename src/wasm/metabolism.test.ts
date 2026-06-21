/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createWasmCore } from './metabolismCore.ts';
import { metaboliseAndReap } from '../core/energy.ts';
import { createSimulation } from '../core/loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from '../core/params.ts';
import { World } from '../core/world.ts';
import { MAX_POPULATION } from '../core/bounds.ts';
import { SIZE, SPEED, METABOLIC_EFFICIENCY, DISPLAY } from '../core/genome.ts';
import { Rng } from '../core/rng.ts';

const wasmBytes = readFileSync(new URL('./metabolism.wasm', import.meta.url));

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, ...over };
}

/** Populate a world with `n` deterministic agents (varied traits/energy/age). */
function seedWorld(world: World, n: number, rng: Rng): void {
  for (let i = 0; i < n; i++) {
    const s = world.spawnAgent();
    world.x[s] = rng.next() * 100;
    world.y[s] = rng.next() * 100;
    world.energy[s] = 0.2 + rng.next() * 3; // some will starve this tick
    world.age[s] = Math.floor(rng.next() * 3100); // some will exceed MAX_AGE
    world.traits[SIZE][s] = 0.5 + rng.next() * 2;
    world.traits[SPEED][s] = rng.next() * 3;
    world.traits[METABOLIC_EFFICIENCY][s] = 0.5 + rng.next();
    world.traits[DISPLAY][s] = rng.next();
  }
}

describe('wasm metabolism core (zero-copy shared memory)', () => {
  it('matches the TypeScript metabolise/reap pass bit-for-bit, in place', () => {
    const p = params({ sexualReproduction: true });
    const a = new World(64, 64);
    const core = createWasmCore(wasmBytes, 64);
    const b = new World(64, 64, core.sharedBuffer); // columns live in shared memory
    seedWorld(a, 50, new Rng(7));
    seedWorld(b, 50, new Rng(7));

    const tsDeaths = metaboliseAndReap(a, p);
    const wasmDeaths = core.metabolism.apply(b, p);

    expect(wasmDeaths).toBe(tsDeaths);
    for (let s = 0; s < a.agentCapacity; s++) {
      expect(b.alive[s]).toBe(a.alive[s]);
      expect(b.age[s]).toBe(a.age[s]);
      expect(b.energy[s]).toBe(a.energy[s]); // bit-for-bit f32
    }
    expect(b.foodEnergy).toEqual(a.foodEnergy); // carrion dropped identically
  });

  it('reproduces a full run identically with the WASM core vs the TS core', () => {
    const p = params({
      seed: 11,
      initialPopulation: 80,
      foodAbundance: 320,
      sexualReproduction: true,
      predation: true,
    });
    const ts = createSimulation(p);
    const wasm = createSimulation(p, undefined, createWasmCore(wasmBytes, MAX_POPULATION));

    for (let i = 0; i < 300; i++) {
      ts.step();
      wasm.step();
    }

    expect(wasm.world.population).toBe(ts.world.population);
    expect(wasm.tick).toBe(ts.tick);
    for (let s = 0; s < ts.world.agentCapacity; s++) {
      expect(wasm.world.alive[s]).toBe(ts.world.alive[s]);
      if (ts.world.alive[s]) {
        expect(wasm.world.energy[s]).toBe(ts.world.energy[s]);
        expect(wasm.world.x[s]).toBe(ts.world.x[s]);
        expect(wasm.world.age[s]).toBe(ts.world.age[s]);
      }
    }
  });
});
