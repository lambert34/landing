import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@g64/types';
import { DATABASE, type Database } from '../../infrastructure/database/database.module.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';

type DependencyStatus = 'ok' | 'unavailable';

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
    const dependencies: { database: DependencyStatus; redis: DependencyStatus } = {
      database: 'ok',
      redis: 'ok',
    };

    try {
      await this.database.client`SELECT 1`;
    } catch {
      dependencies.database = 'unavailable';
    }

    try {
      await this.redis.ping();
    } catch {
      dependencies.redis = 'unavailable';
    }

    if (dependencies.database !== 'ok' || dependencies.redis !== 'ok') {
      throw new ServiceUnavailableException({ status: 'unavailable', dependencies });
    }

    return { status: 'ok', dependencies: { database: 'ok', redis: 'ok' } };
  }
}
