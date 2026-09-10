import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ConfigService } from '../config/config.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async check() {
    let database = 'disconnected';

    try {
      const result = (await this.prisma.$queryRaw`SELECT 1 AS ok`) as Array<{ ok: number }>;
      if (Array.isArray(result) && result.length > 0) {
        database = 'connected';
      }
    } catch {
      database = 'disconnected';
    }

    return {
      status: 'ok',
      database,
      environment: this.config.getString('NODE_ENV', 'development'),
      version: '1.0.0',
    };
  }
}
