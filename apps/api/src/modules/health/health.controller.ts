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
    const database = await this.prisma.ping();

    return {
      status: 'ok',
      database,
      environment: this.config.getString('NODE_ENV', 'development'),
      version: '1.0.0',
    };
  }
}
