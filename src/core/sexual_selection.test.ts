import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { SpatialGrid } from './grid.ts';
import { Rng } from './rng.ts';
import { createSimulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import {
  TRAIT_COUNT,
  SPECIES_TRAIT_COUNT,
  SIZE,
  SPEED,
  SENSE_RADIUS,
  METABOLIC_EFFICIENCY,
  DIET,
  COLOUR_HUE,
  DISPLAY,
  MATE_PREFERENCE,
} from './genome.ts';
import {
  HEADER_LENGTH,
  H_TRAIT_MEANS,
  H_FOOD_COUNT,
  AGENT_STRIDE,
  FOOD_STRIDE,
  snapshotLength,
} from './snapshot.ts';
import { Behaviour } from './behaviour.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return {
    ...DEFAULT_PARAMETERS,
    worldWidth: 300,
    worldHeight: 300,
    sexualReproduction: true,
    ...over,
  };
}

describe('genome growth', () => {
  it('has nine traits with the sexual and immune ones after the six ecological', () => {
    expect(TRAIT_COUNT).toBe(9);
    expect(SPECIES_TRAIT_COUNT).toBe(6);
    expect(DISPLAY).toBe(6);
    expect(MATE_PREFERENCE).toBe(7);
    // resistance (8) sits after the species-defining set, so it is excluded from
    // the genetic-distance gate (which loops t < SPECIES_TRAIT_COUNT).
    expect(SPECIES_TRAIT_COUNT).toBeLessThan(TRAIT_COUNT);
  });

  it('keeps snapshot offsets derived from the trait count', () => {
    expect(H_TRAIT_MEANS).toBe(5);
    expect(H_FOOD_COUNT).toBe(5 + TRAIT_COUNT);
    // The appended mean-knowledge field (culture, 080) takes the header to
    // 7 + TRAIT_COUNT (food count, then mean knowledge, after the trait means).
    expect(HEADER_LENGTH).toBe(7 + TRAIT_COUNT);
    expect(snapshotLength(10, 5)).toBe(HEADER_LENGTH + AGENT_STRIDE * 10 + FOOD_STRIDE * 5);
  });
});

describe('mate choice by preference', () => {
  /** Give a slot a full, valid ecological genome (shared, so candidates are compatible). */
  function setEcology(w: World, s: number): void {
    w.traits[SIZE][s] = 1;
    w.traits[SPEED][s] = 1;
    w.traits[SENSE_RADIUS][s] = 40;
    w.traits[METABOLIC_EFFICIENCY][s] = 1;
    w.traits[DIET][s] = 0;
    w.traits[COLOUR_HUE][s] = 100;
  }

  /**
   * One step with a chooser between two equidistant, compatible candidates that
   * sit just out of mating range (a showy one below, a plain one above), so this
   * isolates *choice* from pairing. Returns the chooser's vertical position after
   * the step: below the start means it courted the showy mate, above the plain.
   */
  function courtedY(preference: number): number {
    const p = params({ reproductionThreshold: 50, mutationRate: 0 });
    const w = new World(8, 1);
    const chooser = w.spawnAgent();
    w.x[chooser] = 150;
    w.y[chooser] = 150;
    w.energy[chooser] = 100;
    w.age[chooser] = 500;
    setEcology(w, chooser);
    w.traits[DISPLAY][chooser] = 0.5;
    w.traits[MATE_PREFERENCE][chooser] = preference;

    const showy = w.spawnAgent();
    w.x[showy] = 150;
    w.y[showy] = 120; // 30 below: beyond MATE_RADIUS, within sense
    w.energy[showy] = 100;
    w.age[showy] = 500;
    setEcology(w, showy);
    w.traits[DISPLAY][showy] = 0.95;
    w.traits[MATE_PREFERENCE][showy] = 0.5;

    const plain = w.spawnAgent();
    w.x[plain] = 150;
    w.y[plain] = 180; // 30 above
    w.energy[plain] = 100;
    w.age[plain] = 500;
    setEcology(w, plain);
    w.traits[DISPLAY][plain] = 0.05;
    w.traits[MATE_PREFERENCE][plain] = 0.5;

    const agents = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.agentCapacity);
    agents.rebuildFromAgents(w);
    const food = new SpatialGrid(p.worldWidth, p.worldHeight, 32, w.foodCapacity);
    new Behaviour(w.agentCapacity).step(w, p, food, agents, new Rng(1));
    return w.y[chooser];
  }

  it('directs courtship by preference — showy-preferring toward the showy mate, plain toward plain', () => {
    expect(courtedY(1.0)).toBeLessThan(150); // prefers showy (below)
    expect(courtedY(0.0)).toBeGreaterThan(150); // prefers plain (above)
  });
});

describe('sexual traits in the full loop', () => {
  it('reproduces a sexual run exactly (determinism with the new traits)', () => {
    const p = params({ initialPopulation: 120, foodAbundance: 240, seed: 9 });
    const run = (): unknown => {
      const sim = createSimulation(p);
      sim.run(400);
      return {
        population: sim.world.population,
        display: Array.from(sim.world.traits[DISPLAY]),
        x: Array.from(sim.world.x),
      };
    };
    expect(run()).toEqual(run());
  });

  it('keeps a dense sexual population bounded with the display cost active', () => {
    const sim = createSimulation(
      params({
        worldWidth: 320,
        worldHeight: 320,
        initialPopulation: 160,
        foodAbundance: 260,
        seed: 2,
      }),
    );
    sim.run(2000);
    expect(sim.world.population).toBeGreaterThan(0);
    expect(sim.world.population).toBeLessThanOrEqual(sim.world.agentCapacity);
  }, 30000);
});
