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
  it('accepts a complete production configuration', () => {
    const result = loadConfig({
      ...valid,
      NODE_ENV: 'production',
      WEB_URL: 'https://www.crypto-g64.ru',
      API_URL: 'https://api.crypto-g64.ru',
      AUTH_COOKIE_DOMAIN: '.crypto-g64.ru',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'mailer',
      SMTP_PASSWORD: 'secret',
      EMAIL_FROM: 'G64 <no-reply@crypto-g64.ru>',
    });
    expect(result.AUTH_COOKIE_DOMAIN).toBe('.crypto-g64.ru');
  });
});
