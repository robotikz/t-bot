import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '../config/config.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check() {
    return {
      status: 'ok',
      storage: 'in-memory',
      environment: this.config.getString('NODE_ENV', 'development'),
      version: '1.0.0',
    };
  }
}
