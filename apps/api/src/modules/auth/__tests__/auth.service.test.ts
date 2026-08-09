import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth.service.js';

const config = {
  DATABASE_URL: 'postgresql://localhost/g64',
  REDIS_URL: 'redis://localhost:6379',
  WEB_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:4000',
  ADMIN_URL: 'http://localhost:3001',
  NODE_ENV: 'test',
  OTP_PEPPER: 'o'.repeat(32),
  RATE_LIMIT_PEPPER: 'r'.repeat(32),
  OTP_TTL_SECONDS: '600',
  OTP_RESEND_SECONDS: '60',
  OTP_MAX_ATTEMPTS: '5',
  SESSION_COOKIE_NAME: 'g64_session',
  SESSION_TTL_SECONDS: '2592000',
};

const storedUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'user@example.com',
  createdAt: new Date('2026-08-09T12:00:00Z'),
  emailVerifiedAt: new Date('2026-08-09T12:00:01Z'),
};

function makeService(overrides: Record<string, unknown> = {}) {
  const repository = {
    userByEmail: vi.fn().mockResolvedValue(storedUser),
    createChallenge: vi.fn(),
    consumeAndAuthenticate: vi.fn(),
    session: vi.fn(),
    revoke: vi.fn(),
    audit: vi.fn(),
    ...overrides,
  };
  const redis = { incrementWithin: vi.fn().mockResolvedValue(true) };
  const email = { sendVerificationCode: vi.fn() };
  const service = new AuthService(repository as never, redis as never, email as never);
  return { service, repository, redis, email };
}

describe('AuthService', () => {
  beforeEach(() => Object.assign(process.env, config));

  it('does not reveal missing login accounts and sends no email', async () => {
    const { service, repository, email } = makeService({
      userByEmail: vi.fn().mockResolvedValue(null),
    });
    const result = await service.requestOtp({
      email: ' Nobody@Example.com ',
      purpose: 'login',
      ip: '127.0.0.1',
    });
    expect(result).toMatchObject({ expiresInSeconds: 600, resendAfterSeconds: 60 });
    expect(email.sendVerificationCode).not.toHaveBeenCalled();
    expect(repository.createChallenge).toHaveBeenCalledWith(
      expect.any(String),
      'nobody@example.com',
      'login',
      expect.not.stringContaining('123456'),
      expect.any(Date),
    );
  });

  it('enforces distributed request limits', async () => {
    const repository = { audit: vi.fn() };
    const service = new AuthService(
      repository as never,
      { incrementWithin: vi.fn().mockResolvedValue(false) } as never,
      {} as never,
    );
    await expect(
      service.requestOtp({ email: 'a@example.com', purpose: 'signup', ip: '1.2.3.4' }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('maps expired, consumed, replayed, or nonexistent challenges to invalid code', async () => {
    const { service, repository } = makeService({
      consumeAndAuthenticate: vi.fn().mockResolvedValue({ status: 'invalid' }),
    });
    await expect(
      service.verifyOtp('11111111-1111-4111-8111-111111111111', '123456'),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.audit).toHaveBeenCalledWith('otp_failed', null);
  });

  it('returns TOO_MANY_ATTEMPTS exactly when the atomic attempt limit is reached', async () => {
    const { service, repository } = makeService({
      consumeAndAuthenticate: vi.fn().mockResolvedValue({ status: 'limited' }),
    });
    await expect(
      service.verifyOtp('11111111-1111-4111-8111-111111111111', '123456'),
    ).rejects.toMatchObject({ status: 429 });
    expect(repository.audit).toHaveBeenCalledWith('otp_failed', null);
  });

  it('consumes a valid duplicate signup before returning ACCOUNT_ALREADY_EXISTS', async () => {
    const { service } = makeService({
      consumeAndAuthenticate: vi.fn().mockResolvedValue({ status: 'account_exists' }),
    });
    await expect(
      service.verifyOtp('11111111-1111-4111-8111-111111111111', '123456'),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('creates a session without passing the raw token to persistence', async () => {
    const consume = vi.fn().mockResolvedValue({
      status: 'authenticated',
      user: storedUser,
      sessionId: '22222222-2222-4222-8222-222222222222',
      purpose: 'login',
    });
    const { service } = makeService({ consumeAndAuthenticate: consume });
    const result = await service.verifyOtp(
      '11111111-1111-4111-8111-111111111111',
      '123456',
    );
    const tokenHash = consume.mock.calls[0]?.[3] as string;
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.sessionToken).not.toBe(tokenHash);
    expect(result.sessionToken).not.toEqual(expect.stringContaining(tokenHash));
  });

  it('accepts a valid session using only the hashed token lookup', async () => {
    const sessionLookup = vi.fn().mockResolvedValue({ sessionId: 'session-id', user: storedUser });
    const { service } = makeService({ session: sessionLookup });
    const result = await service.session('raw-session-token');
    expect(result.authenticated).toBe(true);
    expect(sessionLookup).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(sessionLookup).not.toHaveBeenCalledWith('raw-session-token');
  });

  it('rejects expired or revoked sessions returned as absent by the repository', async () => {
    const { service } = makeService({ session: vi.fn().mockResolvedValue(null) });
    await expect(service.session('expired-or-revoked-token')).resolves.toEqual({
      authenticated: false,
      user: null,
    });
  });

  it('logout revokes the hashed session and writes an audit event', async () => {
    const revoke = vi.fn().mockResolvedValue(storedUser.id);
    const audit = vi.fn();
    const { service } = makeService({ revoke, audit });
    await service.logout('raw-session-token');
    expect(revoke).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(revoke).not.toHaveBeenCalledWith('raw-session-token');
    expect(audit).toHaveBeenCalledWith('session_revoked', null, storedUser.id);
  });
});
