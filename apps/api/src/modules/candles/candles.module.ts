import { Module } from '@nestjs/common';
import { CandlesController } from './candles.controller.js';
import { CandlesService } from './candles.service.js';
import { CandleRepository } from './candle.repository.js';

@Module({
  controllers: [CandlesController],
  providers: [CandlesService, CandleRepository],
  exports: [CandlesService, CandleRepository],
})
export class CandlesModule {}
