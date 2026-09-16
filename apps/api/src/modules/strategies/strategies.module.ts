import { Module } from '@nestjs/common';
import { StrategiesController } from './strategies.controller.js';
import { StrategiesService } from './strategies.service.js';
import { MarketDataModule } from '../market-data/market-data.module.js';
import { StrategyEvaluationService } from './application/strategy-evaluation.service.js';
import { StrategyRegistry } from './application/strategy-registry.service.js';

@Module({
  imports: [MarketDataModule],
  controllers: [StrategiesController],
  providers: [StrategiesService, StrategyRegistry, StrategyEvaluationService],
  exports: [StrategiesService],
})
export class StrategiesModule {}
