import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@g64/types';
import { DATABASE, type Database } from '../../infrastructure/database/database.module.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly redis: RedisService,
  ) {}
  @Get() health(): HealthResponse {
    return { status: 'ok' };
  }
  @Get('ready') async ready(): Promise<{
    status: 'ok';
    dependencies: { database: 'ok'; redis: 'ok' };
  }> {
    try {
      await this.database.client`SELECT 1`;
      await this.redis.ping();
      return { status: 'ok', dependencies: { database: 'ok', redis: 'ok' } };
    } catch {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        dependencies: { database: 'unavailable', redis: 'unavailable' },
      });
    }
  }
}
