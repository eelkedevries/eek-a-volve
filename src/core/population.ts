import type { Simulation } from './loop.ts';
import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { coerceParams } from './share.ts';
import { TRAIT_COUNT, TRAIT_RANGES, clampTrait } from './genome.ts';
import { MAX_POPULATION } from './bounds.ts';

/**
 * Export/import of an evolved population (specification: Locked decisions —
 * export and import of seed, parameters, and genomes). Pure and headless: encode
 * the living population plus the parameters and current tick to a versioned,
 * validated form, and decode it back defensively. Continuation is deterministic
 * from the loaded population and `params.seed`, but is not bit-identical to the
 * original future (only that the loaded run is itself reproducible).
 */

/** Bump if the on-disk shape changes incompatibly. */
export const POPULATION_FORMAT = 1;

/** One creature's exportable state. */
export interface PopulationRecord {
  id: number;
  parentId: number;
  generation: number;
  age: number;
  energy: number;
  x: number;
  y: number;
  traits: number[];
}

/** A whole exported run: format version, tick, parameters, and creatures. */
export interface PopulationSave {
  v: number;
  tick: number;
  params: SimulationParameters;
  creatures: PopulationRecord[];
}

/** Read the living population and run parameters out of a simulation. */
export function extractPopulation(sim: Simulation): PopulationSave {
  const w = sim.world;
  const creatures: PopulationRecord[] = [];
  for (let s = 0; s < w.agentCapacity; s++) {
    if (w.alive[s] !== 1) continue;
    const traits = new Array<number>(TRAIT_COUNT);
    for (let t = 0; t < TRAIT_COUNT; t++) traits[t] = w.traits[t][s];
    creatures.push({
      id: w.id[s],
      parentId: w.parentId[s],
      generation: w.generation[s],
      age: w.age[s],
      energy: w.energy[s],
      x: w.x[s],
      y: w.y[s],
      traits,
    });
  }
  return { v: POPULATION_FORMAT, tick: sim.tick, params: sim.params, creatures };
}

/** Serialise a save to a compact JSON string (for a downloadable file). */
export function encodePopulation(save: PopulationSave): string {
  return JSON.stringify(save);
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function midTrait(t: number): number {
  const r = TRAIT_RANGES[t];
  return (r.min + r.max) / 2;
}

function sanitiseRecord(item: unknown): PopulationRecord | null {
  if (typeof item !== 'object' || item === null) return null;
  const o = item as Record<string, unknown>;
  const rawTraits = Array.isArray(o.traits) ? o.traits : [];
  const traits = new Array<number>(TRAIT_COUNT);
  for (let t = 0; t < TRAIT_COUNT; t++) traits[t] = clampTrait(t, num(rawTraits[t], midTrait(t)));
  return {
    id: Math.max(0, Math.floor(num(o.id, 0))),
    parentId: Math.max(0, Math.floor(num(o.parentId, 0))),
    generation: Math.max(0, Math.floor(num(o.generation, 0))),
    age: Math.max(0, Math.floor(num(o.age, 0))),
    energy: Math.max(0, num(o.energy, 1)),
    x: num(o.x, 0),
    y: num(o.y, 0),
    traits,
  };
}

/**
 * Decode a string produced by {@link encodePopulation}. Defensive: clamps
 * parameters and every creature field, drops malformed records, caps the count at
 * the population ceiling, and falls back to defaults / an empty population for
 * unparseable input. Never throws.
 */
export function decodePopulation(text: string): PopulationSave {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { v: POPULATION_FORMAT, tick: 0, params: { ...DEFAULT_PARAMETERS }, creatures: [] };
  }
  const obj = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  const params = coerceParams(obj.params);
  const tick = Math.max(0, Math.floor(num(obj.tick, 0)));
  const creatures: PopulationRecord[] = [];
  const raw = Array.isArray(obj.creatures) ? obj.creatures : [];
  for (const item of raw) {
    if (creatures.length >= MAX_POPULATION) break;
    const rec = sanitiseRecord(item);
    if (rec !== null) creatures.push(rec);
  }
  return { v: POPULATION_FORMAT, tick, params, creatures };
}
