import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PARAMETERS,
  COMMUNITY_PRESET,
  SWARM_PRESET,
  type SimulationParameters,
} from './params.ts';
import { encodeParams, decodeParams } from './share.ts';

/** Base64url-encode arbitrary JSON the way the codec does, for crafting raw inputs. */
function encodeRaw(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('share codec round-trip', () => {
  const cases: Record<string, SimulationParameters> = {
    defaults: { ...DEFAULT_PARAMETERS },
    community: { ...DEFAULT_PARAMETERS, ...COMMUNITY_PRESET },
    swarm: { ...DEFAULT_PARAMETERS, ...SWARM_PRESET },
    custom: { ...DEFAULT_PARAMETERS, seed: 123456, mutationRate: 0.37, catastrophes: true },
  };

  for (const [name, params] of Object.entries(cases)) {
    it(`reproduces "${name}" exactly`, () => {
      expect(decodeParams(encodeParams(params))).toEqual(params);
    });
  }

  it('produces a compact, URL-safe string (no +, /, =, or whitespace)', () => {
    const encoded = encodeParams(DEFAULT_PARAMETERS);
    expect(encoded).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
});

describe('share codec robustness', () => {
  const keys = Object.keys(DEFAULT_PARAMETERS).sort();

  for (const junk of ['', 'not-valid-base64!!!', '###', 'eyJ', encodeRaw(42), encodeRaw([1, 2, 3])]) {
    it(`falls back to a full, valid parameter set for ${JSON.stringify(junk)}`, () => {
      const decoded = decodeParams(junk);
      expect(Object.keys(decoded).sort()).toEqual(keys);
      for (const [, v] of Object.entries(decoded)) {
        if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      }
    });
  }

  it('clamps out-of-range numbers and coerces bad types', () => {
    const decoded = decodeParams(
      encodeRaw({
        worldWidth: 9_999_999, // above the safe maximum
        seed: -5, // below the minimum
        mutationRate: 9, // above 1
        viewMode: 'nonsense', // not a valid mode
        predation: 'yes', // not a boolean
        initialPopulation: 1.7, // should round to an integer
      }),
    );
    expect(decoded.worldWidth).toBeLessThanOrEqual(4000);
    expect(decoded.seed).toBeGreaterThanOrEqual(0);
    expect(decoded.mutationRate).toBeLessThanOrEqual(1);
    expect(decoded.viewMode).toBe('community');
    expect(decoded.predation).toBe(DEFAULT_PARAMETERS.predation); // bad type ignored
    expect(Number.isInteger(decoded.initialPopulation)).toBe(true);
  });

  it('ignores unknown keys and keeps defaults for missing ones', () => {
    const decoded = decodeParams(encodeRaw({ seed: 99, bogusKey: 'ignored' }));
    expect(decoded.seed).toBe(99);
    expect(decoded.worldWidth).toBe(DEFAULT_PARAMETERS.worldWidth); // missing → default
    expect('bogusKey' in decoded).toBe(false);
  });
});
