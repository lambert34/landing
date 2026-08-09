import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OriginGuard } from '../origin.guard.js';
import { SessionGuard } from '../session.guard.js';

const env = {
  DATABASE_URL: 'postgresql://localhost/g64',
  REDIS_URL: 'redis://localhost:6379',
  WEB_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:4000',
  ADMIN_URL: 'http://localhost:3001',
  NODE_ENV: 'test',
  OTP_PEPPER: 'o'.repeat(32),
  RATE_LIMIT_PEPPER: 'r'.repeat(32),
};

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('auth guards', () => {
  beforeEach(() => Object.assign(process.env, env));

  it('OriginGuard accepts only configured WEB_URL', () => {
    const guard = new OriginGuard();
    expect(guard.canActivate(contextFor({ headers: { origin: 'http://localhost:3000' } }))).toBe(true);
    expect(guard.canActivate(contextFor({ headers: { origin: 'https://evil.example' } }))).toBe(false);
  });

  it('SessionGuard attaches the authenticated user', async () => {
    const user = { id: '1', email: 'u@example.com', createdAt: '', emailVerifiedAt: null };
    const auth = { session: vi.fn().mockResolvedValue({ authenticated: true, user }) };
    const guard = new SessionGuard(auth as never);
    const request: Record<string, unknown> = {
      headers: { cookie: 'g64_session=token' },
      socket: {},
    };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.authUser).toEqual(user);
  });

  it('SessionGuard returns HTTP 401 for missing or invalid sessions', async () => {
    const auth = { session: vi.fn().mockResolvedValue({ authenticated: false, user: null }) };
    const guard = new SessionGuard(auth as never);
    await expect(
      guard.canActivate(contextFor({ headers: {}, socket: {} })),
    ).rejects.toMatchObject({ status: 401 });
  });
});
