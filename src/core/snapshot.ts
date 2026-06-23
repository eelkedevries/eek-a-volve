import type { Simulation } from './loop.ts';
import { TRAIT_COUNT, SIZE, DIET, SENSE_RADIUS, DISPLAY, TRAIT_RANGES } from './genome.ts';
import { energyCapacity } from './energy.ts';
import { stageOf } from './lifestage.ts';

// --- Header (appended fields keep earlier offsets stable for existing consumers) ---
export const H_TICK = 0;
export const H_POPULATION = 1;
export const H_BIRTHS = 2;
export const H_DEATHS = 3;
export const H_SPECIES_COUNT = 4;
export const H_TRAIT_MEANS = 5; // [H_TRAIT_MEANS, H_TRAIT_MEANS + TRAIT_COUNT)
export const H_FOOD_COUNT = 5 + TRAIT_COUNT;
export const HEADER_LENGTH = 6 + TRAIT_COUNT;

// --- Per-agent record (first four kept for back-compat with the simple renderer;
//     later fields appended so existing offsets stay stable) ---
export const A_X = 0;
export const A_Y = 1;
export const A_COLOUR = 2;
export const A_SCALE = 3;
export const A_HEADING = 4;
export const A_STATE = 5;
export const A_ID = 6;
export const A_ENERGY = 7;
/** Diet, normalised 0 (herbivore) … 1 (carnivore) — drives the maw cue. */
export const A_DIET = 8;
/** Sense radius, normalised 0 … 1 — drives eye size. */
export const A_SENSE = 9;
/** Display/ornament, normalised 0 … 1 — drives the visible crest (051). */
export const A_DISPLAY = 10;
/**
 * Infection cue (v0.6.2): 0 = not visibly sick (susceptible/recovered), else a
 * sickness intensity in (0, 1] for an infected host — brighter for a more virulent
 * strain. Appended so existing offsets stay stable; drives the "sick" visual.
 */
export const A_INFECTED = 11;
export const AGENT_STRIDE = 12;

// stateCode packing: (stage << STATE_STAGE_SHIFT) | action
export const STATE_ACTION_MASK = 0b111;
export const STATE_STAGE_SHIFT = 3;
export function packState(stage: number, action: number): number {
  return (stage << STATE_STAGE_SHIFT) | (action & STATE_ACTION_MASK);
}
export function unpackAction(stateCode: number): number {
  return stateCode & STATE_ACTION_MASK;
}
export function unpackStage(stateCode: number): number {
  return stateCode >> STATE_STAGE_SHIFT;
}

// --- Per-food record ---
export const FOOD_X = 0;
export const FOOD_Y = 1;
export const FOOD_TYPE = 2;
export const FOOD_STRIDE = 3;

/** Map a raw trait value to [0, 1] using its declared range (for render cues). */
function normalise(value: number, trait: number): number {
  const r = TRAIT_RANGES[trait];
  return (value - r.min) / (r.max - r.min);
}

/** Float32 length to hold a snapshot for up to these agent and food capacities. */
export function snapshotLength(agentCapacity: number, foodCapacity: number): number {
  return HEADER_LENGTH + AGENT_STRIDE * agentCapacity + FOOD_STRIDE * foodCapacity;
}

/** Offset where the food block begins, given the live agent count (food is packed after the agents). */
export function foodOffset(population: number): number {
  return HEADER_LENGTH + population * AGENT_STRIDE;
}

/**
 * Write a render snapshot of `sim` into `out`: a header of aggregate statistics,
 * a dense block of one record per live agent (x, y, colour index, scale,
 * heading, packed state, id, energy fraction), then a dense food block
 * (x, y, type). Returns the live agent count (food count is in the header).
 * Called at render cadence, so the small scratch here is acceptable.
 */
export function serialiseSnapshot(sim: Simulation, out: Float32Array): number {
  const w = sim.world;
  const { alive, x, y, vx, vy, energy, age, traits, speciesId, action, id, agentCapacity } = w;
  const { infectionState, virulence } = w;
  const sizeCol = traits[SIZE];

  const sums = new Float64Array(TRAIT_COUNT);
  const species = new Set<number>();
  let offset = HEADER_LENGTH;
  let count = 0;
  for (let s = 0; s < agentCapacity; s++) {
    if (alive[s] === 0) continue;
    const size = sizeCol[s];
    out[offset + A_X] = x[s];
    out[offset + A_Y] = y[s];
    out[offset + A_COLOUR] = speciesId[s];
    out[offset + A_SCALE] = size;
    out[offset + A_HEADING] = Math.atan2(vy[s], vx[s]);
    out[offset + A_STATE] = packState(stageOf(age[s]), action[s]);
    out[offset + A_ID] = id[s];
    out[offset + A_ENERGY] = energy[s] / energyCapacity(size);
    out[offset + A_DIET] = normalise(traits[DIET][s], DIET);
    out[offset + A_SENSE] = normalise(traits[SENSE_RADIUS][s], SENSE_RADIUS);
    out[offset + A_DISPLAY] = normalise(traits[DISPLAY][s], DISPLAY);
    // Infection cue: 0 unless infected, else a sickness intensity (brighter for a
    // more virulent strain; virulence is 0 when not evolving, so a plain infection
    // still shows a clear baseline tell).
    out[offset + A_INFECTED] =
      infectionState[s] === 1 ? 0.5 + 0.5 * Math.min(Math.max(virulence[s], 0), 1) : 0;
    offset += AGENT_STRIDE;
    for (let t = 0; t < TRAIT_COUNT; t++) sums[t] += traits[t][s];
    species.add(speciesId[s]);
    count++;
  }

  const { foodAlive, foodX, foodY, foodType, foodCapacity } = w;
  let foodCount = 0;
  for (let f = 0; f < foodCapacity; f++) {
    if (foodAlive[f] === 0) continue;
    out[offset + FOOD_X] = foodX[f];
    out[offset + FOOD_Y] = foodY[f];
    out[offset + FOOD_TYPE] = foodType[f];
    offset += FOOD_STRIDE;
    foodCount++;
  }

  out[H_TICK] = sim.tick;
  out[H_POPULATION] = count;
  out[H_BIRTHS] = sim.births;
  out[H_DEATHS] = sim.deaths;
  out[H_SPECIES_COUNT] = species.size;
  for (let t = 0; t < TRAIT_COUNT; t++) out[H_TRAIT_MEANS + t] = count > 0 ? sums[t] / count : 0;
  out[H_FOOD_COUNT] = foodCount;
  return count;
}
