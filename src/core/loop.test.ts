import { describe, it, expect } from 'vitest';
import { createSimulation, Simulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return {
    ...DEFAULT_PARAMETERS,
    worldWidth: 300,
    worldHeight: 300,
    initialPopulation: 60,
    foodAbundance: 200,
    ...over,
  };
}

function snapshot(sim: Simulation): unknown {
  const w = sim.world;
  return {
    tick: sim.tick,
    population: w.population,
    food: w.foodCount,
    x: Array.from(w.x),
    y: Array.from(w.y),
    energy: Array.from(w.energy),
    age: Array.from(w.age),
    alive: Array.from(w.alive),
    traits: w.traits.map((c) => Array.from(c)),
  };
}

describe('Simulation', () => {
  it('seeds the initial population and food at tick 0', () => {
    const sim = createSimulation(params({ initialPopulation: 30, foodAbundance: 80 }));
    expect(sim.world.population).toBe(30);
    expect(sim.world.foodCount).toBe(80);
    expect(sim.tick).toBe(0);
  });

  it('reproduces identical state for identical seed and params', () => {
    const p = params({ seed: 7 });
    const a = createSimulation(p);
    a.run(200);
    const b = createSimulation(p);
    b.run(200);
    expect(snapshot(a)).toEqual(snapshot(b));
  });

  it('diverges for a different seed', () => {
    const a = createSimulation(params({ seed: 1 }));
    const b = createSimulation(params({ seed: 2 }));
    a.run(100);
    b.run(100);
    expect(snapshot(a)).not.toEqual(snapshot(b));
  });

  it('advances ticks and stays within bounds without reallocating', () => {
    const sim = createSimulation(params({ seed: 3, initialPopulation: 100, foodAbundance: 300 }));
    const xRef = sim.world.x;
    sim.run(300);
    expect(sim.tick).toBe(300);
    expect(sim.world.population).toBeGreaterThanOrEqual(0);
    expect(sim.world.population).toBeLessThanOrEqual(sim.world.agentCapacity);
    expect(sim.births).toBeGreaterThanOrEqual(0);
    expect(sim.deaths).toBeGreaterThanOrEqual(0);
    expect(sim.world.x).toBe(xRef);
  });
});
