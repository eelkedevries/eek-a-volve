import { describe, it, expect } from 'vitest';
import { World } from './world.ts';
import { Rng } from './rng.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { Events } from './events.ts';
import { createSimulation } from './loop.ts';

function params(over: Partial<SimulationParameters> = {}): SimulationParameters {
  return { ...DEFAULT_PARAMETERS, worldWidth: 100, worldHeight: 100, ...over };
}

describe('Events', () => {
  it('meteor kills agents within a region', () => {
    const w = new World(400, 1);
    for (let gx = 0; gx < 20; gx++) {
      for (let gy = 0; gy < 20; gy++) {
        const s = w.spawnAgent();
        w.x[s] = gx * 5;
        w.y[s] = gy * 5;
      }
    }
    const deaths = new Events().trigger('meteor', w, params(), new Rng(1));
    expect(deaths).toBeGreaterThan(0);
    expect(deaths).toBeLessThan(400);
  });

  it('plague kills roughly a third of the population', () => {
    const w = new World(300, 1);
    for (let i = 0; i < 300; i++) w.spawnAgent();
    const deaths = new Events().trigger('plague', w, params(), new Rng(2));
    expect(deaths).toBeGreaterThan(50);
    expect(deaths).toBeLessThan(250);
  });

  it('ice age drains energy and kills the weakest', () => {
    const w = new World(4, 1);
    const weak = w.spawnAgent();
    w.energy[weak] = 10;
    const strong = w.spawnAgent();
    w.energy[strong] = 100;
    const deaths = new Events().trigger('iceAge', w, params(), new Rng(1));
    expect(deaths).toBe(1);
    expect(w.alive[weak]).toBe(0);
    expect(w.alive[strong]).toBe(1);
    expect(w.energy[strong]).toBe(80);
  });

  it('drought removes food', () => {
    const w = new World(1, 100);
    for (let i = 0; i < 100; i++) w.spawnFood();
    new Events().trigger('drought', w, params(), new Rng(3));
    expect(w.foodCount).toBeLessThan(100);
    expect(w.foodCount).toBeGreaterThan(0);
  });

  it('does nothing and records nothing when disabled', () => {
    const w = new World(10, 1);
    for (let i = 0; i < 10; i++) w.spawnAgent();
    const events = new Events();
    let total = 0;
    const rng = new Rng(1);
    for (let t = 0; t < 100; t++) total += events.step(w, params({ catastrophes: false }), rng, t);
    expect(total).toBe(0);
    expect(events.last).toBe(null);
  });

  it('is deterministic and keeps the population bounded with catastrophes on', () => {
    const a = createSimulation(params({ seed: 1, catastrophes: true, initialPopulation: 120, foodAbundance: 300 }));
    const b = createSimulation(params({ seed: 1, catastrophes: true, initialPopulation: 120, foodAbundance: 300 }));
    a.run(2000);
    b.run(2000);
    expect(a.world.population).toBe(b.world.population);
    expect(a.world.population).toBeGreaterThan(0);
    expect(a.world.population).toBeLessThanOrEqual(a.world.agentCapacity);
  }, 30000);
});
