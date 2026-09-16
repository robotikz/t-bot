import { Module } from '@nestjs/common';
import { CandlesController } from './candles.controller.js';
import { CandlesService } from './candles.service.js';
import { CandleRepository } from './candle.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [CandlesController],
  providers: [CandlesService, CandleRepository],
  exports: [CandlesService, CandleRepository],
})
export class CandlesModule {}
