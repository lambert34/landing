import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@g64/types';
@Controller('health')
export class HealthController { @Get() health(): HealthResponse { return { status: 'ok' }; } }
