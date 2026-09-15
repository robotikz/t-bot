import { Module } from '@nestjs/common';
import { TradesController } from './trades.controller.js';
import { TradesService } from './trades.service.js';
import { TradeRepository } from './trade.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [TradesController],
  providers: [TradesService, TradeRepository],
  exports: [TradesService],
})
export class TradesModule {}
