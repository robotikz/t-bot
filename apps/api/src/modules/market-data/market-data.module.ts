import { Module } from '@nestjs/common';
import { BrokersModule } from '../brokers/brokers.module.js';
import { CandlesModule } from '../candles/candles.module.js';
import { ConfigModule } from '../config/config.module.js';
import { MarketDataController } from './market-data.controller.js';
import { MarketDataService } from './market-data.service.js';

@Module({
  imports: [BrokersModule, CandlesModule, ConfigModule],
  controllers: [MarketDataController],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
