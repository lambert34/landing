import { describe, expect, it } from 'vitest';
import { loadConfig } from './index';

const valid = {
  DATABASE_URL: 'postgresql://localhost/g64',
  REDIS_URL: 'redis://localhost:6379',
  WEB_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:4000',
  ADMIN_URL: 'http://localhost:3001',
  NODE_ENV: 'test',
  OTP_PEPPER: 'o'.repeat(32),
  RATE_LIMIT_PEPPER: 'r'.repeat(32),
};

const production = {
  ...valid,
  NODE_ENV: 'production',
  WEB_URL: 'https://crypto-g64.ru',
  API_URL: 'https://api.crypto-g64.ru',
  AUTH_COOKIE_DOMAIN: '.crypto-g64.ru',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: 'mailer',
  SMTP_PASSWORD: 'secret',
  EMAIL_FROM: 'G64 <no-reply@crypto-g64.ru>',
};

describe('loadConfig', () => {
  it('validates a complete environment', () => expect(loadConfig(valid).NODE_ENV).toBe('test'));
  it('rejects missing settings', () => expect(() => loadConfig({})).toThrow());
  it('accepts postgres:// and rediss:// schemes', () =>
    expect(
      loadConfig({
        ...valid,
        DATABASE_URL: 'postgres://localhost/g64',
        REDIS_URL: 'rediss://localhost:6380',
      }).REDIS_URL,
    ).toBe('rediss://localhost:6380'));
  it('rejects unsupported database schemes', () =>
    expect(() => loadConfig({ ...valid, DATABASE_URL: 'https://localhost/g64' })).toThrow());
  it('rejects unsupported Redis schemes', () =>
    expect(() => loadConfig({ ...valid, REDIS_URL: 'https://localhost:6379' })).toThrow());
  it('requires production SMTP and crypto-g64.ru cookie configuration', () =>
    expect(() => loadConfig({ ...valid, NODE_ENV: 'production' })).toThrow());
  it('rejects placeholder production peppers', () =>
    expect(() =>
      loadConfig({
        ...production,
        OTP_PEPPER: 'replace-with-at-least-32-random-bytes',
        RATE_LIMIT_PEPPER: 'replace-with-a-different-32-byte-secret',
      }),
    ).toThrow());
  it('requires independent production peppers', () =>
    expect(() =>
      loadConfig({ ...production, OTP_PEPPER: 'x'.repeat(32), RATE_LIMIT_PEPPER: 'x'.repeat(32) }),
    ).toThrow());
  it('requires the canonical root frontend URL in production', () =>
    expect(() => loadConfig({ ...production, WEB_URL: 'https://www.crypto-g64.ru' })).toThrow());
  it('requires the canonical API URL in production', () =>
    expect(() => loadConfig({ ...production, API_URL: 'https://example.com' })).toThrow());
  it('requires the exact shared production cookie domain', () =>
    expect(() => loadConfig({ ...production, AUTH_COOKIE_DOMAIN: '.sub.crypto-g64.ru' })).toThrow());
  it('accepts a complete production configuration', () => {
    const result = loadConfig(production);
    expect(result.WEB_URL).toBe('https://crypto-g64.ru');
    expect(result.AUTH_COOKIE_DOMAIN).toBe('.crypto-g64.ru');
  });
});
