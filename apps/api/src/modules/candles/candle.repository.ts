import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Timeframe } from '../../common/enums.js';

@Injectable()
export class CandleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(filter: { symbol?: string; timeframe?: Timeframe; limit?: number } = {}) {
    const where: any = {};
    if (filter.symbol) where.symbol = filter.symbol;
    if (filter.timeframe) where.timeframe = filter.timeframe;

    const take = filter.limit ?? 100;

    return (this.prisma as any).candle.findMany({ where, take, orderBy: { closeTime: 'desc' } });
  }
}
