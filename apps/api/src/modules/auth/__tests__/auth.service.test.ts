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
describe('AuthService', () => {
  beforeEach(() => Object.assign(process.env, config));
  it('does not reveal missing login accounts and sends no email', async () => {
    const repository = {
      userByEmail: vi.fn().mockResolvedValue(null),
      createChallenge: vi.fn(),
      audit: vi.fn(),
    };
    const redis = { incrementWithin: vi.fn().mockResolvedValue(true) };
    const email = { sendVerificationCode: vi.fn() };
    const service = new AuthService(repository as never, redis as never, email as never);
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
});
