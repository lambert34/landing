import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';

function controller(databaseOk = true, redisOk = true) {
  const client = vi.fn();
  if (databaseOk) client.mockResolvedValue([]);
  else client.mockRejectedValue(new Error('db down'));
  const redis = {
    ping: redisOk ? vi.fn().mockResolvedValue(undefined) : vi.fn().mockRejectedValue(new Error('redis down')),
  };
  return new HealthController({ client } as never, redis as never);
}

describe('HealthController', () => {
  it('returns the public health contract', () => {
    expect(controller().health()).toEqual({ status: 'ok' });
  });

  it('reports readiness when both dependencies are healthy', async () => {
    await expect(controller().ready()).resolves.toEqual({
      status: 'ok',
      dependencies: { database: 'ok', redis: 'ok' },
    });
  });

  it('distinguishes a PostgreSQL failure from Redis health', async () => {
    await expect(controller(false, true).ready()).rejects.toMatchObject({
      status: 503,
      response: {
        status: 'unavailable',
        dependencies: { database: 'unavailable', redis: 'ok' },
      },
    });
  });

  it('distinguishes a Redis failure from PostgreSQL health', async () => {
    await expect(controller(true, false).ready()).rejects.toMatchObject({
      status: 503,
      response: {
        status: 'unavailable',
        dependencies: { database: 'ok', redis: 'unavailable' },
      },
    });
  });
});
