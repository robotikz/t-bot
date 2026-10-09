import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { SignalTransitionRepository, SignalTransitionRecord } from './signal-transition.repository.js';

@Injectable()
export class PrismaSignalTransitionRepository implements SignalTransitionRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(record: Partial<SignalTransitionRecord>, tx?: any): Promise<SignalTransitionRecord> {
    const db = tx ?? this.prisma;
    const created = await db.signalTransition.create({
      data: {
        symbol: record.symbol ?? 'UNKNOWN',
        fromState: record.fromState ?? null,
        toState: record.toState ?? 'UNKNOWN',
        observedAt: record.observedAt ?? new Date(),
        observationId: record.observationId ?? ''
      }
    });

    return {
      id: created.id,
      symbol: created.symbol,
      fromState: created.fromState,
      toState: created.toState,
      observedAt: created.observedAt,
      observationId: created.observationId,
      createdAt: created.createdAt
    };
  }

  async findLatestBySymbol(symbol: string, tx?: any) {
    const db = tx ?? this.prisma;
    const rec = await db.signalTransition.findFirst({ where: { symbol }, orderBy: { observedAt: 'desc' } });
    if (!rec) return null;
    return {
      id: rec.id,
      symbol: rec.symbol,
      fromState: rec.fromState,
      toState: rec.toState,
      observedAt: rec.observedAt,
      observationId: rec.observationId,
      createdAt: rec.createdAt
    };
  }

  async find(filter: { symbol?: string; from?: string; to?: string }) {
    const where: any = {};
    if (filter.symbol) where.symbol = filter.symbol;
    if (filter.from) where.fromState = filter.from;
    if (filter.to) where.toState = filter.to;

    const items = await this.prisma.signalTransition.findMany({ where, orderBy: { observedAt: 'desc' } });
    return items.map((rec) => ({
      id: rec.id,
      symbol: rec.symbol,
      fromState: rec.fromState,
      toState: rec.toState,
      observedAt: rec.observedAt,
      observationId: rec.observationId,
      createdAt: rec.createdAt
    }));
  }
}
