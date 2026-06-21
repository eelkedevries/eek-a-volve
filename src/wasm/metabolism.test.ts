/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createWasmCore } from './metabolismCore.ts';
import { metaboliseAndReap } from '../core/energy.ts';
import { breed, breedSexual } from '../core/mutation.ts';
import { createSimulation, GRID_CELL_SIZE } from '../core/loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from '../core/params.ts';
import { World } from '../core/world.ts';
import { MAX_POPULATION } from '../core/bounds.ts';
import { CARRION_RESERVE } from '../core/food.ts';
import { SIZE, SPEED, METABOLIC_EFFICIENCY, DISPLAY, TRAIT_COUNT, TRAIT_RANGES } from '../core/genome.ts';
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
    const core = createWasmCore(wasmBytes, 64, 64, 200, 200, GRID_CELL_SIZE);
    const b = new World(64, 64, core.sharedBuffer); // columns live in shared memory
    seedWorld(a, 50, new Rng(7));
    seedWorld(b, 50, new Rng(7));

    const tsDeaths = metaboliseAndReap(a, p);
    const wasmDeaths = core.metabolise(b, p);

    expect(wasmDeaths).toBe(tsDeaths);
    for (let s = 0; s < a.agentCapacity; s++) {
      expect(b.alive[s]).toBe(a.alive[s]);
      expect(b.age[s]).toBe(a.age[s]);
      expect(b.energy[s]).toBe(a.energy[s]); // bit-for-bit f32
    }
    expect(b.foodEnergy).toEqual(a.foodEnergy); // carrion dropped identically
  });

  it('runs the WASM regen path for default, seasonal, and biome params', () => {
    const core = createWasmCore(wasmBytes, 64, 64, 200, 200, GRID_CELL_SIZE);
    const w = new World(64, 64, core.sharedBuffer);
    core.setRng(new Rng(1));
    expect(core.regenerateFood(w, params(), 0)).toBe(true);
    expect(core.regenerateFood(w, params({ seasonAmplitude: 0.5, seasonPeriod: 400 }), 100)).toBe(true);
    expect(core.regenerateFood(w, params({ biomeStrength: 0.5 }), 0)).toBe(true);
  });

  it('reproduces seasonal and biome full runs identically (WASM regen vs TS)', () => {
    for (const extra of [
      { seasonAmplitude: 0.6, seasonPeriod: 300 },
      { biomeStrength: 0.8 },
    ]) {
      const p = params({ seed: 21, initialPopulation: 70, foodAbundance: 300, ...extra });
      const ts = createSimulation(p);
      const wasm = createSimulation(
        p,
        undefined,
        createWasmCore(wasmBytes, MAX_POPULATION, p.foodAbundance + CARRION_RESERVE, p.worldWidth, p.worldHeight, GRID_CELL_SIZE),
      );
      for (let i = 0; i < 250; i++) {
        ts.step();
        wasm.step();
      }
      expect(wasm.world.population).toBe(ts.world.population);
      expect(wasm.world.foodCount).toBe(ts.world.foodCount);
      for (let s = 0; s < ts.world.agentCapacity; s++) {
        if (ts.world.alive[s]) expect(wasm.world.x[s]).toBe(ts.world.x[s]);
      }
    }
  });

  it('reproduces a seasonal full run identically (WASM seasonal regen vs TS)', () => {
    const p = params({ seed: 21, initialPopulation: 70, foodAbundance: 300, seasonAmplitude: 0.6, seasonPeriod: 300 });
    const ts = createSimulation(p);
    const wasm = createSimulation(
      p,
      undefined,
      createWasmCore(wasmBytes, MAX_POPULATION, p.foodAbundance + CARRION_RESERVE, p.worldWidth, p.worldHeight, GRID_CELL_SIZE),
    );
    for (let i = 0; i < 250; i++) {
      ts.step();
      wasm.step();
    }
    expect(wasm.world.population).toBe(ts.world.population);
    expect(wasm.world.foodCount).toBe(ts.world.foodCount);
    for (let s = 0; s < ts.world.agentCapacity; s++) {
      if (ts.world.alive[s]) expect(wasm.world.x[s]).toBe(ts.world.x[s]);
    }
  });

  it('matches the TS breed/breedSexual bit-for-bit (mutation, clamping, freaks, RNG)', () => {
    const p = params({ mutationRate: 0.5, mutationMagnitude: 0.2 });
    for (const sexual of [false, true]) {
      const core = createWasmCore(wasmBytes, 16, 16, 200, 200, GRID_CELL_SIZE);
      const tsW = new World(16, 16);
      const wW = new World(16, 16, core.sharedBuffer);
      for (let t = 0; t < TRAIT_COUNT; t++) {
        const r = TRAIT_RANGES[t];
        const a = r.min + 0.3 * (r.max - r.min);
        const b = r.min + 0.7 * (r.max - r.min);
        tsW.traits[t][0] = a;
        wW.traits[t][0] = a;
        tsW.traits[t][1] = b;
        wW.traits[t][1] = b;
      }
      const tsRng = new Rng(9);
      const wRng = new Rng(9);
      core.setRng(wRng);
      for (let i = 0; i < 80; i++) {
        if (sexual) {
          breedSexual(tsW, 2, 0, 1, p, tsRng);
          core.breedSexual(2, 0, 1, p);
        } else {
          breed(tsW, 2, 0, p, tsRng);
          core.breed(2, 0, p);
        }
        for (let t = 0; t < TRAIT_COUNT; t++) expect(wW.traits[t][2]).toBe(tsW.traits[t][2]);
      }
      expect(wRng.next()).toBe(tsRng.next()); // RNG stayed in lockstep
    }
  });

  it('gates the WASM behaviour pass on no-brains, no-pheromones', () => {
    const core = createWasmCore(wasmBytes, 64, 64, 200, 200, GRID_CELL_SIZE);
    expect(core.canRunBehaviour(params({ sexualReproduction: true }))).toBe(true);
    expect(core.canRunBehaviour(params({ pheromones: true }))).toBe(false);
    expect(core.canRunBehaviour(params({ neuralBrains: true }))).toBe(false);
  });

  it('stays identical with catastrophes and immigration on (TS passes, shared RNG)', () => {
    const p = params({
      seed: 5,
      initialPopulation: 80,
      foodAbundance: 320,
      sexualReproduction: true,
      predation: true,
      catastrophes: true,
      immigration: true,
    });
    const ts = createSimulation(p);
    const wasm = createSimulation(
      p,
      undefined,
      createWasmCore(wasmBytes, MAX_POPULATION, p.foodAbundance + CARRION_RESERVE, p.worldWidth, p.worldHeight, GRID_CELL_SIZE),
    );
    for (let i = 0; i < 400; i++) {
      ts.step();
      wasm.step();
    }
    expect(wasm.world.population).toBe(ts.world.population);
    for (let s = 0; s < ts.world.agentCapacity; s++) {
      expect(wasm.world.alive[s]).toBe(ts.world.alive[s]);
      if (ts.world.alive[s]) {
        expect(wasm.world.x[s]).toBe(ts.world.x[s]);
        expect(wasm.world.energy[s]).toBe(ts.world.energy[s]);
        expect(wasm.world.id[s]).toBe(ts.world.id[s]); // immigrant ids match
      }
    }
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
    const wasm = createSimulation(
      p,
      undefined,
      createWasmCore(
        wasmBytes,
        MAX_POPULATION,
        p.foodAbundance + CARRION_RESERVE,
        p.worldWidth,
        p.worldHeight,
        GRID_CELL_SIZE,
      ),
    );

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
        expect(wasm.world.y[s]).toBe(ts.world.y[s]);
        expect(wasm.world.age[s]).toBe(ts.world.age[s]);
        expect(wasm.world.id[s]).toBe(ts.world.id[s]); // spawnAgent id assignment
        expect(wasm.world.generation[s]).toBe(ts.world.generation[s]); // reproduction
        expect(wasm.world.speciesId[s]).toBe(ts.world.speciesId[s]);
      }
    }

    // Food state must match too, so carrion decay (062) is verified, not just agents.
    expect(wasm.world.foodCount).toBe(ts.world.foodCount);
    expect(wasm.world.carrionCount).toBe(ts.world.carrionCount);
    for (let f = 0; f < ts.world.foodCapacity; f++) {
      expect(wasm.world.foodAlive[f]).toBe(ts.world.foodAlive[f]);
      if (ts.world.foodAlive[f]) {
        expect(wasm.world.foodType[f]).toBe(ts.world.foodType[f]);
        expect(wasm.world.foodDecay[f]).toBe(ts.world.foodDecay[f]);
        expect(wasm.world.foodX[f]).toBe(ts.world.foodX[f]);
      }
    }
  });
});
