import type { Simulation } from './loop.ts';
import { TRAIT_COUNT, SIZE } from './genome.ts';
import { stageOf } from './lifestage.ts';
import { energyCapacity } from './energy.ts';
import { resolveAncestry } from './lineage.ts';

/**
 * The full state of one creature, pulled on demand for the inspector. The render
 * snapshot only carries what the picture needs; this carries everything the panel
 * shows. Plain data, so it crosses the worker boundary by structured clone.
 */
export interface CreatureDetail {
  id: number;
  /** False if the creature is no longer alive (the panel then clears). */
  alive: boolean;
  traits: number[];
  age: number;
  stage: number;
  energy: number;
  energyCapacity: number;
  speciesId: number;
  action: number;
  generation: number;
  offspringCount: number;
  /** Ancestor ids, nearest-first (parent, grandparent, …); empty for a founder. */
  ancestry: number[];
}

/** A detail record for a stable `id`, or a not-alive record if it is gone. */
export function inspectCreature(sim: Simulation, id: number): CreatureDetail {
  const w = sim.world;
  for (let s = 0; s < w.agentCapacity; s++) {
    if (w.alive[s] === 1 && w.id[s] === id) {
      const traits = new Array<number>(TRAIT_COUNT);
      for (let t = 0; t < TRAIT_COUNT; t++) traits[t] = w.traits[t][s];
      return {
        id,
        alive: true,
        traits,
        age: w.age[s],
        stage: stageOf(w.age[s]),
        energy: w.energy[s],
        energyCapacity: energyCapacity(w.traits[SIZE][s]),
        speciesId: w.speciesId[s],
        action: w.action[s],
        generation: w.generation[s],
        offspringCount: w.offspringCount[s],
        ancestry: resolveAncestry(w, sim.lineage, id),
      };
    }
  }
  return {
    id,
    alive: false,
    traits: [],
    age: 0,
    stage: 0,
    energy: 0,
    energyCapacity: 0,
    speciesId: 0,
    action: 0,
    generation: 0,
    offspringCount: 0,
    ancestry: [],
  };
}
