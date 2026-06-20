import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, SPEED, SENSE_RADIUS, DIET } from './genome.ts';
import { Behaviour } from './behaviour.ts';
import {
  evaluate,
  BRAIN_INPUTS,
  BRAIN_OUTPUTS,
  BRAIN_HIDDEN,
  BRAIN_WEIGHT_COUNT,
} from './brain.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 200, worldHeight: 200, ...over };
}

describe('brain network', () => {
  it('has a consistent weight count for its topology', () => {
    expect(BRAIN_WEIGHT_COUNT).toBe(
      BRAIN_INPUTS * BRAIN_HIDDEN + BRAIN_HIDDEN + BRAIN_HIDDEN * BRAIN_OUTPUTS + BRAIN_OUTPUTS,
    );
  });

  it('is deterministic and bounded in [-1, 1]', () => {
    const w = new Float32Array(BRAIN_WEIGHT_COUNT);
    const rng = new Rng(5);
    for (let k = 0; k < w.length; k++) w[k] = rng.next() * 2 - 1;
    const inputs = new Float32Array([0.3, -0.7, 0.1, 0.9, 0.5, 1]);
    const a = new Float32Array(BRAIN_OUTPUTS);
    const b = new Float32Array(BRAIN_OUTPUTS);
    evaluate(w, 0, inputs, a);
    evaluate(w, 0, inputs, b);
    expect(Array.from(a)).toEqual(Array.from(b));
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('maps an input to an output through a hand-set path', () => {
    // Wire input 0 → hidden 0 → output 0 with strong positive weights, rest zero.
    const w = new Float32Array(BRAIN_WEIGHT_COUNT);
    w[0] = 3; // input0 → hidden0
    w[BRAIN_HIDDEN * (BRAIN_INPUTS + 1)] = 3; // hidden0 → output0
    const out = new Float32Array(BRAIN_OUTPUTS);
    const inHigh = new Float32Array([1, 0, 0, 0, 0, 0]);
    const inLow = new Float32Array([-1, 0, 0, 0, 0, 0]);
    evaluate(w, 0, inHigh, out);
    const high = out[0];
    evaluate(w, 0, inLow, out);
    const low = out[0];
    expect(high).toBeGreaterThan(0);
    expect(low).toBeLessThan(0);
  });
});

describe('neural brains in the world', () => {
  it('allocates no brain memory by default and does when enabled', () => {
    expect(new World(4, 1).brainWeights).toBeNull();
    const w = new World(4, 1);
    w.enableBrains(BRAIN_WEIGHT_COUNT);
    expect(w.brainWeights).not.toBeNull();
    expect(w.brainWeights!.length).toBe(4 * BRAIN_WEIGHT_COUNT);
  });

  it('steers a creature toward food via its weights', () => {
    const p = params({ neuralBrains: true, reproductionThreshold: 1e9 });
    const w = new World(4, 4);
    w.enableBrains(BRAIN_WEIGHT_COUNT);
    const a = w.spawnAgent();
    w.x[a] = 100;
    w.y[a] = 100;
    w.energy[a] = 50;
    w.traits[SIZE][a] = 1;
    w.traits[SPEED][a] = 4;
    w.traits[SENSE_RADIUS][a] = 50;
    w.traits[DIET][a] = 0;
    // Weights so output X follows the food-direction-x input (index 0).
    const base = a * BRAIN_WEIGHT_COUNT;
    w.brainWeights![base + 0] = 4; // input0 (foodDx) → hidden0
    w.brainWeights![base + BRAIN_HIDDEN * (BRAIN_INPUTS + 1)] = 4; // hidden0 → output0 (dx)
    const f = w.spawnFood();
    w.foodX[f] = 140; // food to the right
    w.foodY[f] = 100;
    const agents = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.agentCapacity);
    agents.rebuildFromAgents(w);
    const food = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.foodCapacity);
    food.insert(f, w.foodX[f], w.foodY[f]);
    new Behaviour(w.agentCapacity).step(w, p, food, agents, new Rng(1));
    expect(w.x[a]).toBeGreaterThan(100); // moved toward the food (its weights say so)
  });

  it('inherits weights on reproduction (copy under no mutation)', () => {
    const p = params({ neuralBrains: true, reproductionThreshold: 50, mutationRate: 0, sexualReproduction: false });
    const w = new World(8, 1);
    w.enableBrains(BRAIN_WEIGHT_COUNT);
    const a = w.spawnAgent();
    w.x[a] = 50; w.y[a] = 50; w.energy[a] = 100; w.age[a] = 400;
    w.traits[SIZE][a] = 1; w.traits[SPEED][a] = 0; w.traits[SENSE_RADIUS][a] = 5; w.traits[DIET][a] = 0;
    const base = a * BRAIN_WEIGHT_COUNT;
    for (let k = 0; k < BRAIN_WEIGHT_COUNT; k++) w.brainWeights![base + k] = (k % 7) * his(k);
    const agents = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.agentCapacity);
    agents.rebuildFromAgents(w);
    const food = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.foodCapacity);
    const births = new Behaviour(w.agentCapacity).step(w, p, food, agents, new Rng(1));
    expect(births).toBe(1);
    let child = -1;
    for (let s = 0; s < w.agentCapacity; s++) if (w.alive[s] && s !== a) child = s;
    const cb = child * BRAIN_WEIGHT_COUNT;
    for (let k = 0; k < BRAIN_WEIGHT_COUNT; k++) {
      expect(w.brainWeights![cb + k]).toBeCloseTo(w.brainWeights![base + k], 5);
    }
  });

  it('reproduces a brains-on run exactly and leaves the default path unchanged', () => {
    const on = params({ neuralBrains: true, initialPopulation: 60, foodAbundance: 300, seed: 4 });
    const runOn = (): number => {
      const sim = createSimulation(on);
      sim.run(200);
      return sim.world.population;
    };
    expect(runOn()).toBe(runOn());

    // Default (off) ignores brains entirely.
    const off = params({ initialPopulation: 60, foodAbundance: 300, seed: 4 });
    const sim = createSimulation(off);
    expect(sim.world.brainWeights).toBeNull();
  });
});

/** Small deterministic helper so the inherited weights are varied but finite. */
function his(k: number): number {
  return ((k * 2654435761) % 1000) / 1000 - 0.5;
}
