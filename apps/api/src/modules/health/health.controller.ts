import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@g64/types';
import { DATABASE, type Database } from '../../infrastructure/database/database.module.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';

type DependencyStatus = 'ok' | 'unavailable';

const DEPENDENCY_TIMEOUT_MS = 5_000;

async function withTimeout(operation: Promise<unknown>): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Dependency health check timed out')),
          DEPENDENCY_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly redis: RedisService,
  ) {}

  @Get()
  health(): HealthResponse {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{
    status: 'ok';
    dependencies: { database: 'ok'; redis: 'ok' };
  }> {
    const [databaseResult, redisResult] = await Promise.allSettled([
      withTimeout(this.database.client`SELECT 1`),
      withTimeout(this.redis.ping()),
    ]);

    const dependencies: { database: DependencyStatus; redis: DependencyStatus } = {
      database: databaseResult.status === 'fulfilled' ? 'ok' : 'unavailable',
      redis: redisResult.status === 'fulfilled' ? 'ok' : 'unavailable',
    };

    if (dependencies.database !== 'ok' || dependencies.redis !== 'ok') {
      throw new ServiceUnavailableException({ status: 'unavailable', dependencies });
    }

    return { status: 'ok', dependencies: { database: 'ok', redis: 'ok' } };
  }
}
