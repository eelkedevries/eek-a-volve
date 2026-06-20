import { describe, it, expect } from 'vitest';
import { isOffscreenSupported } from './offscreenClient.ts';

// Rendering itself is not unit-tested (testing policy), but the capability gate
// that decides whether to use the experimental offscreen path — and thus whether
// to fall back to the main-thread renderer — is pure and worth pinning down.
describe('offscreen capability gate', () => {
  it('returns a boolean and is false in a headless environment (so we fall back)', () => {
    const supported = isOffscreenSupported();
    expect(typeof supported).toBe('boolean');
    expect(supported).toBe(false);
  });
});
