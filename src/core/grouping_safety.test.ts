import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import { Predation, captureProbability, GROUP_RADIUS } from './predation.ts';
import { createSimulation, GRID_CELL_SIZE } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, DIET } from './genome.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 300, worldHeight: 300, ...over };
}

describe('grouping safety', () => {
  describe('capture probability', () => {
    it('is 1 for an isolated prey and falls with group size', () => {
      expect(captureProbability(1, 1.5)).toBe(1);
      expect(captureProbability(5, 1.5)).toBeLessThan(captureProbability(2, 1.5));
      expect(captureProbability(20, 1.5)).toBeLessThan(captureProbability(5, 1.5));
    });

    it('saturates (diminishing marginal cover) and strengthens with the coefficient', () => {
      const earlyGain = captureProbability(2, 1) - captureProbability(3, 1); // +1 to a small group
      const lateGain = captureProbability(11, 1) - captureProbability(12, 1); // +1 to a big group
      expect(lateGain).toBeLessThan(earlyGain);
      expect(captureProbability(5, 2)).toBeLessThan(captureProbability(5, 1));
    });
  });

  /**
   * One predation step: a predator targeting a focal prey that has `neighbours`
   * conspecifics within GROUP_RADIUS of it but outside the predator's strike
   * range. Returns the fraction of seeds in which the focal prey was eaten.
   */
  function captureRate(neighbours: number, groupingSafety: number, seeds: number): number {
    let eaten = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const w = new World(64, 8);
      const pred = w.spawnAgent();
      w.x[pred] = 100;
      w.y[pred] = 100;
      w.speciesId[pred] = 2;
      w.traits[SIZE][pred] = 2;
      w.traits[DIET][pred] = 1;
      const prey = w.spawnAgent();
      w.x[prey] = 103; // 3 from predator: within ATTACK_RADIUS
      w.y[prey] = 100;
      w.speciesId[prey] = 1;
      w.traits[SIZE][prey] = 0.5;
      w.traits[DIET][prey] = 0;
      for (let i = 0; i < neighbours; i++) {
        const n = w.spawnAgent();
        w.x[n] = 111 + i * 1.5; // 8–~26 from prey (within GROUP_RADIUS), >5 from predator
        w.y[n] = 100;
        w.speciesId[n] = 1;
        w.traits[SIZE][n] = 0.5;
        w.traits[DIET][n] = 0;
      }
      const grid = new SpatialGrid(300, 300, GRID_CELL_SIZE, w.agentCapacity);
      grid.rebuildFromAgents(w);
      new Predation().step(w, params({ predation: true, groupingSafety }), grid, new Rng(seed));
      if (w.alive[prey] === 0) eaten++;
    }
    return eaten / seeds;
  }

  it('dilutes predation: a crowded prey is caught far less often than an isolated one', () => {
    expect(GROUP_RADIUS).toBeGreaterThan(0);
    const isolated = captureRate(0, 1.5, 200);
    const crowded = captureRate(12, 1.5, 200);
    expect(isolated).toBe(1); // group size 1 ⇒ capture probability 1 ⇒ always caught
    expect(crowded).toBeLessThan(0.3);
    expect(crowded).toBeLessThan(isolated);
  });

  it('reproduces a run exactly with grouping safety on (determinism)', () => {
    const p = params({ groupingSafety: 1.5, initialPopulation: 140, foodAbundance: 260, seed: 5 });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(400);
      return { population: sim.world.population, x: Array.from(sim.world.x) };
    };
    expect(run()).toEqual(run());
  });

  it('keeps predation active and the population bounded with grouping on', () => {
    const sim = createSimulation(
      params({
        groupingSafety: 1.5,
        initialPopulation: 160,
        foodAbundance: 260,
        predation: true,
        seed: 3,
      }),
    );
    sim.run(2000);
    expect(sim.world.population).toBeGreaterThan(0);
    expect(sim.world.population).toBeLessThanOrEqual(sim.world.agentCapacity);
  }, 30000);
});
