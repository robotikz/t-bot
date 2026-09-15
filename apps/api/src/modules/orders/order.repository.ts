import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { OrderStatus } from '../../common/enums.js';

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: { exchange?: string; status?: OrderStatus; symbol?: string } = {}) {
    const where: any = {};
    if (filter.exchange) where.exchange = { name: filter.exchange };
    if (filter.status) where.status = filter.status;
    if (filter.symbol) where.symbol = filter.symbol;

    return (this.prisma as any).order.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
}
