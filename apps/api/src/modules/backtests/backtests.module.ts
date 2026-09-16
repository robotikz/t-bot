import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module.js';
import { StrategiesModule } from '../strategies/strategies.module.js';
import { BacktestService } from './backtest.service.js';
import { BacktestsController } from './backtests.controller.js';

@Module({
  imports: [MarketDataModule, StrategiesModule],
  controllers: [BacktestsController],
  providers: [BacktestService],
})
export class BacktestsModule {}
