import { Module } from '@nestjs/common';
import { StrategiesController } from './strategies.controller.js';
import { StrategiesService } from './strategies.service.js';
import { StrategyRepository } from './strategy.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [StrategiesController],
  providers: [StrategiesService, StrategyRepository],
  exports: [StrategiesService],
})
export class StrategiesModule {}
