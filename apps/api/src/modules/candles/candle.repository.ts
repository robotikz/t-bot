import { Injectable } from '@nestjs/common';
import type { Timeframe } from '../../common/enums.js';
import type { BrokerId, Candle } from '../brokers/domain/types.js';

type StoredCandle = {
  id: string;
  brokerId: BrokerId;
  symbol: string;
  timeframe: Timeframe;
  openTime: Date;
  closeTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

@Injectable()
export class CandleRepository {
  private readonly candles = new Map<string, StoredCandle>();

  async upsertMany(
    candles: Array<Required<Pick<Candle, 'brokerId' | 'symbol' | 'timeframe' | 'openTime'>> & Omit<Candle, 'brokerId' | 'symbol' | 'timeframe' | 'openTime'>>,
  ) {
    if (!candles.length) {
      return [];
    }

    const records: StoredCandle[] = [];
    for (const candle of candles) {
      const key = this.key(candle.brokerId, candle.symbol, candle.timeframe, candle.openTime);
      const existing = this.candles.get(key);
      const next: StoredCandle = {
        id: existing?.id ?? `candle-${this.candles.size + 1}`,
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
      };

      this.candles.set(key, next);
      records.push(next);
    }

    return records;
  }

  async findMany(filter: { brokerId?: BrokerId; symbol?: string; timeframe?: Timeframe; limit?: number } = {}) {
    const take = filter.limit ?? 100;

    return Array.from(this.candles.values())
      .filter((entry) => (!filter.brokerId || entry.brokerId === filter.brokerId)
        && (!filter.symbol || entry.symbol === filter.symbol)
        && (!filter.timeframe || entry.timeframe === filter.timeframe))
      .sort((left, right) => left.openTime.getTime() - right.openTime.getTime())
      .slice(0, take);
  }

  async findByBrokerSymbolTimeframe(filter: { brokerId: BrokerId; symbol: string; timeframe: Timeframe; limit?: number }) {
    return this.findMany(filter);
  }

  async findByBrokerSymbolTimeframeRange(filter: {
    brokerId: BrokerId;
    symbol: string;
    timeframe: Timeframe;
    startTime: Date;
    endTime: Date;
  }) {
    return Array.from(this.candles.values())
      .filter((entry) => entry.brokerId === filter.brokerId
        && entry.symbol === filter.symbol
        && entry.timeframe === filter.timeframe
        && entry.openTime.getTime() >= filter.startTime.getTime()
        && entry.openTime.getTime() <= filter.endTime.getTime())
      .sort((left, right) => left.openTime.getTime() - right.openTime.getTime());
  }

  async findLatest(filter: { brokerId: BrokerId; symbol: string; timeframe: Timeframe }) {
    return Array.from(this.candles.values())
      .filter((entry) => entry.brokerId === filter.brokerId && entry.symbol === filter.symbol && entry.timeframe === filter.timeframe)
      .sort((left, right) => right.openTime.getTime() - left.openTime.getTime())[0] ?? null;
  }

  private key(brokerId: BrokerId, symbol: string, timeframe: Timeframe, openTime: Date): string {
    return `${brokerId}::${symbol}::${timeframe}::${openTime.toISOString()}`;
  }
}
