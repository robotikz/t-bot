import { Module } from '@nestjs/common';
import { ConfigModule } from './modules/config/config.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [ConfigModule, PrismaModule, HealthModule],
})
export class AppModule {}
