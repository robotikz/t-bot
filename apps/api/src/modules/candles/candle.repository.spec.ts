import { describe, expect, it, vi } from 'vitest';
import { CandleRepository } from './candle.repository.js';
import { Timeframe } from '../../common/enums.js';

function createPrismaMock() {
  const store: Array<Record<string, unknown>> = [];

  return {
    store,
    candle: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = JSON.stringify(where.brokerId_symbol_timeframe_openTime);
        const existingIndex = store.findIndex((entry: any) => JSON.stringify({ brokerId: entry.brokerId, symbol: entry.symbol, timeframe: entry.timeframe, openTime: entry.openTime.toISOString() }) === key);

        if (existingIndex >= 0) {
          store[existingIndex] = { ...store[existingIndex], ...update };
          return store[existingIndex];
        }

        const record = { id: `candle-${store.length + 1}`, ...create };
        store.push(record);
        return record;
      }),
      findMany: vi.fn(async ({ where, take, orderBy }: any) => {
        const records = store.filter((entry: any) => {
          return (!where.brokerId || entry.brokerId === where.brokerId)
            && (!where.symbol || entry.symbol === where.symbol)
            && (!where.timeframe || entry.timeframe === where.timeframe);
        });

        const sorted = [...records].sort((left: any, right: any) => {
          const leftValue = left[orderBy.openTime ? 'openTime' : 'openTime'].getTime();
          const rightValue = right[orderBy.openTime ? 'openTime' : 'openTime'].getTime();
          return orderBy.openTime === 'asc' ? leftValue - rightValue : rightValue - leftValue;
        });

        return sorted.slice(0, take);
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        const records = store.filter((entry: any) => {
          return entry.brokerId === where.brokerId && entry.symbol === where.symbol && entry.timeframe === where.timeframe;
        });

        const sorted = [...records].sort((left: any, right: any) => right.openTime.getTime() - left.openTime.getTime());
        return sorted[0] ?? null;
      }),
    },
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };
}

describe('CandleRepository', () => {
  it('upserts candles by broker, symbol, timeframe, and openTime', async () => {
    const prisma = createPrismaMock();
    const repository = new CandleRepository(prisma as never);
    const candle = {
      brokerId: 'bybit',
      symbol: 'BTCUSDT',
      timeframe: Timeframe.H1,
      openTime: new Date('2026-09-16T10:00:00.000Z'),
      closeTime: new Date('2026-09-16T10:59:59.999Z'),
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 25,
    };

    await repository.upsertMany([candle]);
    await repository.upsertMany([candle]);

    expect(prisma.candle.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.store).toHaveLength(1);
  });

  it('finds candles in chronological order', async () => {
    const prisma = createPrismaMock();
    const repository = new CandleRepository(prisma as never);

    await repository.upsertMany([
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        openTime: new Date('2026-09-16T11:00:00.000Z'),
        closeTime: new Date('2026-09-16T11:59:59.999Z'),
        open: 105,
        high: 115,
        low: 100,
        close: 110,
        volume: 20,
      },
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        openTime: new Date('2026-09-16T10:00:00.000Z'),
        closeTime: new Date('2026-09-16T10:59:59.999Z'),
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 25,
      },
    ]);

    const candles = await repository.findMany({ brokerId: 'bybit', symbol: 'BTCUSDT', timeframe: Timeframe.H1, limit: 10 });

    expect(candles).toHaveLength(2);
    expect(candles[0].openTime.toISOString()).toBe('2026-09-16T10:00:00.000Z');
    expect(candles[1].openTime.toISOString()).toBe('2026-09-16T11:00:00.000Z');
  });

  it('finds the latest candle', async () => {
    const prisma = createPrismaMock();
    const repository = new CandleRepository(prisma as never);

    await repository.upsertMany([
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        openTime: new Date('2026-09-16T10:00:00.000Z'),
        closeTime: new Date('2026-09-16T10:59:59.999Z'),
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 25,
      },
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        openTime: new Date('2026-09-16T11:00:00.000Z'),
        closeTime: new Date('2026-09-16T11:59:59.999Z'),
        open: 105,
        high: 115,
        low: 100,
        close: 110,
        volume: 20,
      },
    ]);

    const latest = await repository.findLatest({ brokerId: 'bybit', symbol: 'BTCUSDT', timeframe: Timeframe.H1 });

    expect(latest?.openTime.toISOString()).toBe('2026-09-16T11:00:00.000Z');
  });
});
