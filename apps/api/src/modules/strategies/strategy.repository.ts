import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class StrategyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: { name?: string; enabled?: boolean } = {}) {
    const where: any = {};
    if (typeof filter.enabled === 'boolean') where.enabled = filter.enabled;
    if (filter.name) where.name = filter.name;

    return (this.prisma as any).strategy.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
}
