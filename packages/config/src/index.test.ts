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
});
