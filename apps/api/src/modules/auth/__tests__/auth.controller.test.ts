import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from '../auth.controller.js';

const baseEnv = {
  DATABASE_URL: 'postgresql://localhost/g64',
  REDIS_URL: 'redis://localhost:6379',
  WEB_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:4000',
  ADMIN_URL: 'http://localhost:3001',
  OTP_PEPPER: 'o'.repeat(32),
  RATE_LIMIT_PEPPER: 'r'.repeat(32),
  OTP_TTL_SECONDS: '600',
  OTP_RESEND_SECONDS: '60',
  OTP_MAX_ATTEMPTS: '5',
  SESSION_COOKIE_NAME: 'g64_session',
  SESSION_TTL_SECONDS: '2592000',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: 'user',
  SMTP_PASSWORD: 'password',
  EMAIL_FROM: 'G64 <no-reply@crypto-g64.ru>',
};

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'user@example.com',
  createdAt: '2026-08-09T12:00:00.000Z',
  emailVerifiedAt: '2026-08-09T12:00:01.000Z',
};

function request() {
  return { headers: {}, socket: { remoteAddress: '127.0.0.1' }, ip: '127.0.0.1' } as never;
}

function response() {
  return { cookie: vi.fn(), clearCookie: vi.fn() };
}

describe('AuthController', () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('AUTH_') || key.startsWith('SMTP_') || key === 'NODE_ENV') delete process.env[key];
    }
    Object.assign(process.env, baseEnv, { NODE_ENV: 'test', AUTH_COOKIE_DOMAIN: '' });
  });

  it('exposes the OTP request contract', async () => {
    const auth = {
      requestOtp: vi.fn().mockResolvedValue({
        challengeId: '11111111-1111-4111-8111-111111111111',
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      }),
    };
    const controller = new AuthController(auth as never);
    await expect(
      controller.requestOtp({ email: 'user@example.com', purpose: 'signup' }, request()),
    ).resolves.toEqual({
      challengeId: '11111111-1111-4111-8111-111111111111',
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
  });

  it('verifies OTP, sets an HttpOnly cookie, and never returns the raw token in JSON', async () => {
    const auth = { verifyOtp: vi.fn().mockResolvedValue({ sessionToken: 'raw-secret', user }) };
    const controller = new AuthController(auth as never);
    const res = response();
    const body = await controller.verifyOtp(
      { challengeId: '11111111-1111-4111-8111-111111111111', code: '123456' },
      res as never,
    );
    expect(body).toEqual({ authenticated: true, user });
    expect(JSON.stringify(body)).not.toContain('raw-secret');
    expect(res.cookie).toHaveBeenCalledWith(
      'g64_session',
      'raw-secret',
      expect.objectContaining({ httpOnly: true, secure: false, sameSite: 'lax', path: '/' }),
    );
  });

  it('uses production Secure cookie attributes and the shared crypto-g64.ru domain', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      AUTH_COOKIE_DOMAIN: '.crypto-g64.ru',
    });
    const auth = { verifyOtp: vi.fn().mockResolvedValue({ sessionToken: 'raw-secret', user }) };
    const controller = new AuthController(auth as never);
    const res = response();
    await controller.verifyOtp(
      { challengeId: '11111111-1111-4111-8111-111111111111', code: '123456' },
      res as never,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'g64_session',
      'raw-secret',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        domain: '.crypto-g64.ru',
      }),
    );
  });

  it('returns authenticated and unauthenticated session contracts', async () => {
    const authenticated = new AuthController(
      { session: vi.fn().mockResolvedValue({ authenticated: true, user }) } as never,
    );
    await expect(authenticated.session(request())).resolves.toEqual({ authenticated: true, user });

    const unauthenticated = new AuthController(
      { session: vi.fn().mockResolvedValue({ authenticated: false, user: null }) } as never,
    );
    await expect(unauthenticated.session(request())).resolves.toEqual({
      authenticated: false,
      user: null,
    });
  });

  it('logout revokes the current session and clears the cookie', async () => {
    const auth = { logout: vi.fn().mockResolvedValue(undefined) };
    const controller = new AuthController(auth as never);
    const res = response();
    const req = {
      headers: { cookie: 'g64_session=raw-secret' },
      socket: { remoteAddress: '127.0.0.1' },
    } as never;
    await expect(controller.logout(req, res as never)).resolves.toEqual({ success: true });
    expect(auth.logout).toHaveBeenCalledWith('raw-secret');
    expect(res.clearCookie).toHaveBeenCalledWith(
      'g64_session',
      expect.objectContaining({ httpOnly: true, secure: false, sameSite: 'lax', path: '/' }),
    );
  });
});
