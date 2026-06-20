import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { SIZE, SPEED, SENSE_RADIUS, DIET } from './genome.ts';
import { Behaviour } from './behaviour.ts';
import { PheromoneField } from './pheromone.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 200, worldHeight: 200, ...over };
}

function total(field: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < field.length; i++) sum += field[i];
  return sum;
}

describe('PheromoneField', () => {
  it('decays and diffuses deterministically', () => {
    const run = (): number[] => {
      const f = new PheromoneField(100, 100, 25); // 4×4 grid
      f.deposit(50, 50, 100);
      for (let i = 0; i < 10; i++) f.step(0.9, 0.2);
      return Array.from(f.field);
    };
    expect(run()).toEqual(run());
  });

  it('decay shrinks the total and diffusion spreads to neighbours', () => {
    const f = new PheromoneField(100, 100, 25); // cols = rows = 4
    f.deposit(50, 50, 100); // cell (cx=2, cy=2), index 10
    const before = total(f.field);
    expect(f.field[9]).toBe(0); // left neighbour starts empty
    f.step(0.9, 0.5);
    expect(total(f.field)).toBeLessThan(before); // decay removed energy
    expect(f.field[9]).toBeGreaterThan(0); // diffusion reached the neighbour
  });

  it('gradient points toward higher pheromone', () => {
    const f = new PheromoneField(100, 100, 25); // 4×4
    f.deposit(90, 50, 100); // far-right column (cx=3, cy=2)
    const mag = f.sampleGradient(50, 50); // sampling at cx=2, cy=2
    expect(mag).toBeGreaterThan(0);
    expect(f.gradX).toBeGreaterThan(0); // increasing toward +x
    expect(Math.abs(f.gradY)).toBeLessThan(Math.abs(f.gradX));
  });
});

describe('pheromone behaviour', () => {
  it('a creature with no food sensed climbs the local trail', () => {
    const p = params({ pheromones: true, reproductionThreshold: 1e9 });
    const w = new World(4, 1);
    const a = w.spawnAgent();
    w.x[a] = 100;
    w.y[a] = 100;
    w.energy[a] = 50;
    w.traits[SIZE][a] = 1;
    w.traits[SPEED][a] = 5;
    w.traits[SENSE_RADIUS][a] = 8; // no food anywhere, so it falls to wandering
    w.traits[DIET][a] = 0;
    const field = new PheromoneField(p.worldWidth, p.worldHeight, p.pheromoneCellSize);
    // A trail that increases toward +x.
    for (let cx = 0; cx < field.cols; cx++) {
      for (let cy = 0; cy < field.rows; cy++) field.field[cy * field.cols + cx] = cx;
    }
    const agents = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.agentCapacity);
    agents.rebuildFromAgents(w);
    const food = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.foodCapacity);
    new Behaviour(w.agentCapacity).step(w, p, food, agents, new Rng(1), field);
    expect(w.x[a]).toBeGreaterThan(100); // moved up-gradient (+x)
  });

  /** Mean distance of a fixed cohort to a corner after following (or not) a static trail to it. */
  function meanDistanceToCorner(pheromones: boolean): number {
    const p = params({ pheromones, reproductionThreshold: 1e9, predation: false });
    const w = new World(16, 1);
    const rng = new Rng(42);
    const ids: number[] = [];
    for (let i = 0; i < 12; i++) {
      const a = w.spawnAgent();
      w.x[a] = 100 + (i % 4);
      w.y[a] = 100 + Math.floor(i / 4);
      w.energy[a] = 1e6; // behaviour-only stepping: no metabolism, no starvation
      w.traits[SIZE][a] = 1;
      w.traits[SPEED][a] = 3;
      w.traits[SENSE_RADIUS][a] = 6;
      w.traits[DIET][a] = 0;
      ids.push(a);
    }
    const field = new PheromoneField(p.worldWidth, p.worldHeight, p.pheromoneCellSize);
    // A static trail rising toward the (0, 0) corner.
    const layTrail = (): void => {
      for (let cx = 0; cx < field.cols; cx++) {
        for (let cy = 0; cy < field.rows; cy++) {
          field.field[cy * field.cols + cx] = field.cols - cx + (field.rows - cy);
        }
      }
    };
    const behaviour = new Behaviour(w.agentCapacity);
    const food = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.foodCapacity);
    for (let t = 0; t < 40; t++) {
      layTrail(); // re-impose the trail each tick (no eating happens here to refresh it)
      const agents = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.agentCapacity);
      agents.rebuildFromAgents(w);
      behaviour.step(w, p, food, agents, rng, field);
    }
    let sum = 0;
    for (const a of ids) sum += Math.hypot(w.x[a], w.y[a]);
    return sum / ids.length;
  }

  it('cohorts aggregate along a trail more than with the feature disabled', () => {
    const following = meanDistanceToCorner(true);
    const wandering = meanDistanceToCorner(false);
    expect(following).toBeLessThan(wandering);
  });
});

describe('pheromone determinism in the full loop', () => {
  it('reproduces a run exactly with pheromones enabled', () => {
    const p = params({
      worldWidth: 300,
      worldHeight: 300,
      initialPopulation: 60,
      foodAbundance: 200,
      pheromones: true,
      seed: 5,
    });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(300);
      return {
        population: sim.world.population,
        field: Array.from(sim.pheromone.field),
        x: Array.from(sim.world.x),
      };
    };
    expect(run()).toEqual(run());
  });
});
