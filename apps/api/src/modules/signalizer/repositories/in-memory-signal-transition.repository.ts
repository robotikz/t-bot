import { Injectable } from '@nestjs/common';
import type { SignalTransitionRecord, SignalTransitionRepository } from './signal-transition.repository.js';

@Injectable()
export class InMemorySignalTransitionRepository implements SignalTransitionRepository {
  private readonly items: SignalTransitionRecord[] = [];

  async create(record: Partial<SignalTransitionRecord>): Promise<SignalTransitionRecord> {
    const created: SignalTransitionRecord = {
      id: record.id ?? `tr_${this.items.length + 1}`,
      symbol: record.symbol ?? 'UNKNOWN',
      fromState: record.fromState ?? null,
      toState: record.toState ?? 'UNKNOWN',
      observedAt: record.observedAt ?? new Date(),
      observationId: record.observationId ?? '',
      createdAt: record.createdAt ?? new Date(),
    };

    this.items.push(created);
    return created;
  }

  async findLatestBySymbol(symbol: string): Promise<SignalTransitionRecord | null> {
    const latest = this.items
      .filter((item) => item.symbol === symbol)
      .sort((left, right) => right.observedAt.getTime() - left.observedAt.getTime())[0];

    return latest ?? null;
  }

  async find(filter: { symbol?: string; from?: string; to?: string }): Promise<SignalTransitionRecord[]> {
    let result = [...this.items].sort((left, right) => right.observedAt.getTime() - left.observedAt.getTime());

    if (filter.symbol) result = result.filter((item) => item.symbol === filter.symbol);
    if (filter.from) result = result.filter((item) => item.fromState === filter.from);
    if (filter.to) result = result.filter((item) => item.toState === filter.to);

    return result;
  }
}
