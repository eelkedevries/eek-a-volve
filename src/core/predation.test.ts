import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, DIET } from './genome.ts';
import { Predation } from './predation.ts';
import { createSimulation } from './loop.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 100, worldHeight: 100, ...over };
}

function grid(w: World, p: SimulationParameters): SpatialGrid {
  const g = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.agentCapacity);
  g.rebuildFromAgents(w);
  return g;
}

function pair(predSize: number, predDiet: number, preySize: number, preyDx: number): World {
  const w = new World(8, 1);
  const pred = w.spawnAgent();
  w.x[pred] = 50; w.y[pred] = 50; w.energy[pred] = 10;
  w.traits[SIZE][pred] = predSize; w.traits[DIET][pred] = predDiet;
  const prey = w.spawnAgent();
  w.x[prey] = 50 + preyDx; w.y[prey] = 50; w.energy[prey] = 10;
  w.traits[SIZE][prey] = preySize; w.traits[DIET][prey] = 0.1;
  return w;
}

describe('Predation', () => {
  it('lets a carnivore eat a smaller neighbour when enabled', () => {
    const w = pair(2, 0.9, 0.5, 2);
    const deaths = new Predation().step(w, params({ predation: true }), grid(w, params()));
    expect(deaths).toBe(1);
    expect(w.population).toBe(1);
    let survivor = -1;
    for (let s = 0; s < w.agentCapacity; s++) if (w.alive[s]) survivor = s;
    expect(w.energy[survivor]).toBeGreaterThan(10); // the predator gained energy
  });

  it('does nothing when predation is disabled', () => {
    const w = pair(2, 0.9, 0.5, 2);
    expect(new Predation().step(w, params({ predation: false }), grid(w, params())).valueOf()).toBe(0);
    expect(w.population).toBe(2);
  });

  it('spares herbivorous predators, large prey, and distant prey', () => {
    const p = params({ predation: true });
    const herbivore = pair(2, 0.1, 0.5, 2); // predator not carnivorous
    expect(new Predation().step(herbivore, p, grid(herbivore, p))).toBe(0);
    const bigPrey = pair(1, 0.9, 0.95, 2); // prey not small enough (0.95 > 0.8)
    expect(new Predation().step(bigPrey, p, grid(bigPrey, p))).toBe(0);
    const farPrey = pair(2, 0.9, 0.5, 30); // beyond the attack radius
    expect(new Predation().step(farPrey, p, grid(farPrey, p))).toBe(0);
  });

  it('is deterministic and keeps the population bounded with predation on', () => {
    const a = createSimulation(params({ seed: 1, predation: true, initialPopulation: 80, foodAbundance: 200 }));
    const b = createSimulation(params({ seed: 1, predation: true, initialPopulation: 80, foodAbundance: 200 }));
    a.run(500);
    b.run(500);
    expect(a.world.population).toBe(b.world.population);
    expect(a.world.population).toBeGreaterThan(0);
    expect(a.world.population).toBeLessThanOrEqual(a.world.agentCapacity);
  });
});
