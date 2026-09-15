import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class TradeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: { exchange?: string; symbol?: string } = {}) {
    const where: any = {};
    if (filter.exchange) where.exchange = { name: filter.exchange };
    if (filter.symbol) where.symbol = filter.symbol;

    return (this.prisma as any).trade.findMany({ where, orderBy: { executedAt: 'desc' } });
  }
}
