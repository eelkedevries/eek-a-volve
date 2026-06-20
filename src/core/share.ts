import { DEFAULT_PARAMETERS, type SimulationParameters } from './params.ts';
import { MAX_POPULATION } from './bounds.ts';

/**
 * Pure, headless codec for a shareable run: the whole {@link SimulationParameters}
 * object (seed included) to and from a compact, URL-safe string. A run is fully
 * reproducible from these parameters and the seed (specification: Data schemas;
 * Locked decisions — export/import of seed and parameters), so a link is enough
 * to hand someone the exact same world. No DOM access here.
 */

/** Marks an encoded run in the URL fragment, as in `#w=<encoded>`. */
export const SHARE_HASH_PREFIX = 'w=';

/** Safe inclusive bounds for known numeric parameters when decoding untrusted input. */
const NUMERIC_BOUNDS: Record<string, { min: number; max: number; integer?: boolean }> = {
  worldWidth: { min: 50, max: 4000, integer: true },
  worldHeight: { min: 50, max: 4000, integer: true },
  seed: { min: 0, max: 0xffffffff, integer: true },
  initialPopulation: { min: 1, max: MAX_POPULATION, integer: true },
  startingSpeciesCount: { min: 1, max: 64, integer: true },
  foodAbundance: { min: 0, max: 5000, integer: true },
  foodRegenRate: { min: 0, max: 200 },
  startingEnergy: { min: 1, max: 1000 },
  baseMetabolicCost: { min: 0, max: 10 },
  reproductionThreshold: { min: 1, max: 100000 },
  mutationRate: { min: 0, max: 1 },
  mutationMagnitude: { min: 0, max: 5 },
  pheromoneCellSize: { min: 4, max: 256 },
  pheromoneDecay: { min: 0, max: 1 },
  pheromoneDiffusion: { min: 0, max: 1 },
  pheromoneDeposit: { min: 0, max: 1000 },
  biomeStrength: { min: 0, max: 1 },
  seasonAmplitude: { min: 0, max: 1 },
  seasonPeriod: { min: 1, max: 1_000_000, integer: true },
  minTimeMultiplier: { min: 0.01, max: 64 },
  maxTimeMultiplier: { min: 0.02, max: 256 },
};

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const padded = s.length % 4 === 0 ? s : s + '='.repeat(4 - (s.length % 4));
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

function clampNumeric(key: string, value: number): number {
  const b = NUMERIC_BOUNDS[key];
  if (b === undefined) return value; // unknown numeric param: accept any finite value
  let v = value < b.min ? b.min : value > b.max ? b.max : value;
  if (b.integer) v = Math.round(v);
  return v;
}

/** Encode a parameter set to a compact, URL-safe string (stable key order). */
export function encodeParams(params: SimulationParameters): string {
  const obj: Record<string, unknown> = {};
  const source = params as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_PARAMETERS)) obj[key] = source[key];
  return toBase64Url(JSON.stringify(obj));
}

/**
 * Coerce an arbitrary value into a valid parameter set: start from
 * {@link DEFAULT_PARAMETERS} and overwrite a field only when the incoming value is
 * well-typed, clamping numbers to safe bounds, coercing `viewMode`, dropping
 * unknown keys, and keeping the default for anything missing or malformed. Never
 * throws. Shared by the share-link and population codecs.
 */
export function coerceParams(raw: unknown): SimulationParameters {
  const result: SimulationParameters = { ...DEFAULT_PARAMETERS };
  if (typeof raw !== 'object' || raw === null) return result;

  const obj = raw as Record<string, unknown>;
  const target = result as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_PARAMETERS)) {
    if (!(key in obj)) continue;
    const def = (DEFAULT_PARAMETERS as unknown as Record<string, unknown>)[key];
    const value = obj[key];
    if (key === 'viewMode') {
      target[key] = value === 'swarm' ? 'swarm' : 'community';
    } else if (typeof def === 'boolean') {
      if (typeof value === 'boolean') target[key] = value;
    } else if (typeof def === 'number') {
      if (typeof value === 'number' && Number.isFinite(value)) target[key] = clampNumeric(key, value);
    }
  }

  // Keep the multiplier bounds coherent relative to one another.
  if (result.maxTimeMultiplier <= result.minTimeMultiplier) {
    result.minTimeMultiplier = DEFAULT_PARAMETERS.minTimeMultiplier;
    result.maxTimeMultiplier = DEFAULT_PARAMETERS.maxTimeMultiplier;
  }
  return result;
}

/**
 * Decode a string produced by {@link encodeParams} back into a parameter set.
 * Defensive by design (see {@link coerceParams}); never throws.
 */
export function decodeParams(text: string): SimulationParameters {
  try {
    return coerceParams(JSON.parse(fromBase64Url(text)));
  } catch {
    return { ...DEFAULT_PARAMETERS };
  }
}
