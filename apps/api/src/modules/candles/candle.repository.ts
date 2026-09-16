import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Timeframe } from '../../common/enums.js';
import type { BrokerId, Candle } from '../brokers/domain/types.js';

@Injectable()
export class CandleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMany(
    candles: Array<Required<Pick<Candle, 'brokerId' | 'symbol' | 'timeframe' | 'openTime'>> & Omit<Candle, 'brokerId' | 'symbol' | 'timeframe' | 'openTime'>>,
  ) {
    if (!candles.length) {
      return [];
    }

    return this.prisma.$transaction(
      candles.map((candle) =>
        this.prisma.candle.upsert({
          where: {
            brokerId_symbol_timeframe_openTime: {
              brokerId: candle.brokerId,
              symbol: candle.symbol,
              timeframe: candle.timeframe,
              openTime: candle.openTime,
            },
          },
          create: {
            brokerId: candle.brokerId,
            symbol: candle.symbol,
            timeframe: candle.timeframe,
            openTime: candle.openTime,
            closeTime: candle.closeTime,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
          },
          update: {
            closeTime: candle.closeTime,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
          },
        }),
      ),
    );
  }

  async findMany(filter: { brokerId?: BrokerId; symbol?: string; timeframe?: Timeframe; limit?: number } = {}) {
    const where: Record<string, unknown> = {};
    if (filter.brokerId) where.brokerId = filter.brokerId;
    if (filter.symbol) where.symbol = filter.symbol;
    if (filter.timeframe) where.timeframe = filter.timeframe;

    const take = filter.limit ?? 100;

    return this.prisma.candle.findMany({ where, take, orderBy: { openTime: 'asc' } });
  }

  async findByBrokerSymbolTimeframe(filter: { brokerId: BrokerId; symbol: string; timeframe: Timeframe; limit?: number }) {
    return this.findMany(filter);
  }

  async findLatest(filter: { brokerId: BrokerId; symbol: string; timeframe: Timeframe }) {
    return this.prisma.candle.findFirst({
      where: {
        brokerId: filter.brokerId,
        symbol: filter.symbol,
        timeframe: filter.timeframe,
      },
      orderBy: { openTime: 'desc' },
    });
  }
}
