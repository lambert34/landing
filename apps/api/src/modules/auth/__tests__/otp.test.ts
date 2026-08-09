import { describe, expect, it, vi } from 'vitest';
import {
  generateOtp,
  normalizeEmail,
  otpDigest,
  sessionHash,
  verifyDigest,
} from '../auth.crypto.js';
describe('auth crypto', () => {
  it('always creates six decimal digits', () => {
    for (let i = 0; i < 100; i += 1) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
  it('retains leading zero padding', async () => {
    vi.resetModules();
    vi.doMock('node:crypto', async (original) => ({
      ...(await original<typeof import('node:crypto')>()),
      randomInt: () => 7,
    }));
    const module = await import('../auth.crypto.js');
    expect(module.generateOtp()).toBe('000007');
    vi.doUnmock('node:crypto');
  });
  it('uses a keyed digest and timing-safe verification', () => {
    const digest = otpDigest('p'.repeat(32), 'challenge', '123456');
    expect(digest).not.toContain('123456');
    expect(verifyDigest(digest, otpDigest('p'.repeat(32), 'challenge', '123456'))).toBe(true);
    expect(verifyDigest(digest, otpDigest('p'.repeat(32), 'challenge', '654321'))).toBe(false);
  });
  it('normalizes without provider-specific rewriting', () =>
    expect(normalizeEmail(' User.Name+tag@Example.COM ')).toBe('user.name+tag@example.com'));
  it('hashes opaque sessions without persisting the token', () =>
    expect(sessionHash('raw-secret-token')).not.toContain('raw-secret-token'));
});
