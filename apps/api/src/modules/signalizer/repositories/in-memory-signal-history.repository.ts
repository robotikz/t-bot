import { Injectable } from '@nestjs/common';
import type { SignalHistoryRepository, SignalObservationRecord } from './signal-history.repository.js';

@Injectable()
export class InMemorySignalHistoryRepository implements SignalHistoryRepository {
  private readonly items: SignalObservationRecord[] = [];

  async create(record: Partial<SignalObservationRecord>): Promise<SignalObservationRecord> {
    const created: SignalObservationRecord = {
      id: record.id ?? `obs_${this.items.length + 1}`,
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
      createdAt: record.createdAt ?? new Date(),
    };

    this.items.push(created);
    return created;
  }

  async findLatestBySymbol(symbol: string): Promise<SignalObservationRecord | null> {
    const latest = this.items
      .filter((item) => item.symbol === symbol)
      .sort((left, right) => right.observedAt.getTime() - left.observedAt.getTime())[0];

    return latest ?? null;
  }

  async find(filter: { symbol?: string; state?: string; from?: Date; to?: Date; limit?: number }): Promise<SignalObservationRecord[]> {
    let result = [...this.items].sort((left, right) => right.observedAt.getTime() - left.observedAt.getTime());

    if (filter.symbol) result = result.filter((item) => item.symbol === filter.symbol);
    if (filter.state) result = result.filter((item) => item.currentState === filter.state);
    if (filter.from) result = result.filter((item) => item.observedAt.getTime() >= filter.from!.getTime());
    if (filter.to) result = result.filter((item) => item.observedAt.getTime() <= filter.to!.getTime());

    return result.slice(0, filter.limit ?? 100);
  }
}
