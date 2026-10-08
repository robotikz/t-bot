import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { SignalHistoryRepository, SignalObservationRecord } from './signal-history.repository.js';

@Injectable()
export class PrismaSignalHistoryRepository implements SignalHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(record: Partial<SignalObservationRecord>): Promise<SignalObservationRecord> {
    const created = await this.prisma.signalObservation.create({
      data: {
        symbol: record.symbol ?? 'UNKNOWN',
        sourceSymbol: record.sourceSymbol ?? record.symbol ?? 'UNKNOWN',
        targetSymbol: record.targetSymbol ?? 'UNKNOWN',
        observedAt: record.observedAt ?? new Date(),
        previousState: record.previousState ?? null,
        currentState: record.currentState ?? 'UNKNOWN',
        confidence: record.confidence ?? null,
        risk: record.risk ?? null,
        setupSnapshot: record.setupSnapshot ?? {},
        aiDecision: record.aiDecision ?? null,
        reasons: record.reasons ?? [],
        rejections: record.rejections ?? [],
        usdcAvailable: !!record.usdcAvailable,
        pairValidation: record.pairValidation ?? {},
        currentPrice: record.currentPrice ?? 0,
        timeframeInfo: record.timeframeInfo ?? {},
      }
    });

    return {
      id: created.id,
      symbol: created.symbol,
      sourceSymbol: created.sourceSymbol,
      targetSymbol: created.targetSymbol,
      observedAt: created.observedAt,
      previousState: created.previousState,
      currentState: created.currentState,
      confidence: created.confidence,
      risk: created.risk,
      setupSnapshot: created.setupSnapshot,
      aiDecision: created.aiDecision,
      reasons: created.reasons,
      rejections: created.rejections,
      usdcAvailable: created.usdcAvailable,
      pairValidation: created.pairValidation,
      currentPrice: created.currentPrice,
      timeframeInfo: created.timeframeInfo,
      createdAt: created.createdAt
    };
  }

  async findLatestBySymbol(symbol: string) {
    const rec = await this.prisma.signalObservation.findFirst({
      where: { symbol },
      orderBy: { observedAt: 'desc' }
    });
    if (!rec) return null;
    return {
      id: rec.id,
      symbol: rec.symbol,
      sourceSymbol: rec.sourceSymbol,
      targetSymbol: rec.targetSymbol,
      observedAt: rec.observedAt,
      previousState: rec.previousState,
      currentState: rec.currentState,
      confidence: rec.confidence,
      risk: rec.risk,
      setupSnapshot: rec.setupSnapshot,
      aiDecision: rec.aiDecision,
      reasons: rec.reasons,
      rejections: rec.rejections,
      usdcAvailable: rec.usdcAvailable,
      pairValidation: rec.pairValidation,
      currentPrice: rec.currentPrice,
      timeframeInfo: rec.timeframeInfo,
      createdAt: rec.createdAt
    };
  }

  async find(filter: { symbol?: string; state?: string; from?: Date; to?: Date; limit?: number }) {
    const where: any = {};
    if (filter.symbol) where.symbol = filter.symbol;
    if (filter.state) where.currentState = filter.state;
    if (filter.from || filter.to) where.observedAt = {};
    if (filter.from) where.observedAt.gte = filter.from;
    if (filter.to) where.observedAt.lte = filter.to;

    const items = await this.prisma.signalObservation.findMany({
      where,
      orderBy: { observedAt: 'desc' },
      take: filter.limit ?? 100
    });

    return items.map((rec) => ({
        id: rec.id,
      symbol: rec.symbol,
      sourceSymbol: rec.sourceSymbol,
      targetSymbol: rec.targetSymbol,
      observedAt: rec.observedAt,
      previousState: rec.previousState,
      currentState: rec.currentState,
      confidence: rec.confidence,
      risk: rec.risk,
      setupSnapshot: rec.setupSnapshot,
      aiDecision: rec.aiDecision,
      reasons: rec.reasons,
      rejections: rec.rejections,
      usdcAvailable: rec.usdcAvailable,
      pairValidation: rec.pairValidation,
      currentPrice: rec.currentPrice,
      timeframeInfo: rec.timeframeInfo,
      createdAt: rec.createdAt
    }));
  }
}
