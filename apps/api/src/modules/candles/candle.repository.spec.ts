import { describe, expect, it } from 'vitest';
import { CandleRepository } from './candle.repository.js';
import { Timeframe } from '../../common/enums.js';

describe('CandleRepository', () => {
  it('upserts candles by broker, symbol, timeframe, and openTime', async () => {
    const repository = new CandleRepository();
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

    const stored = await repository.findMany({ brokerId: 'bybit', symbol: 'BTCUSDT', timeframe: Timeframe.H1, limit: 10 });
    expect(stored).toHaveLength(1);
  });

  it('finds candles in chronological order', async () => {
    const repository = new CandleRepository();

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
    const repository = new CandleRepository();

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
