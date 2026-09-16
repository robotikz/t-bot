import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Timeframe } from '../brokers/domain/types.js';
import { BacktestService } from './backtest.service.js';

function createCandle(index: number, price: number) {
  const openTime = new Date(Date.UTC(2026, 0, 1, index));
  const closeTime = new Date(Date.UTC(2026, 0, 1, index, 59, 59, 999));

  return {
    symbol: 'BTCUSDT',
    timeframe: Timeframe.H1,
    openTime,
    closeTime,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 1,
    isClosed: true,
  };
}

describe('BacktestService', () => {
  function createService() {
    const marketDataService = {
      loadCandlesInRange: vi.fn(),
    };

    const strategyRegistry = {
      evaluate: vi.fn(),
    };

    return {
      service: new BacktestService(marketDataService as never, strategyRegistry as never),
      marketDataService,
      strategyRegistry,
    };
  }

  it('runs a backtest with valid input', async () => {
    const { service, marketDataService, strategyRegistry } = createService();
    marketDataService.loadCandlesInRange.mockResolvedValue([createCandle(0, 100), createCandle(1, 110), createCandle(2, 120)]);
    strategyRegistry.evaluate.mockImplementation((_strategyId: string, context: { candles: Array<{ closeTime: Date; close: number }> }) => {
      const latest = context.candles.at(-1)!;
      return {
        strategyId: 'ema-crossover',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        type: context.candles.length === 1 ? 'BUY' : 'HOLD',
        timestamp: latest.closeTime,
        price: latest.close,
        reason: 'planned',
      };
    });

    const result = await service.run({
      brokerId: 'bybit',
      symbol: 'BTCUSDT',
      timeframe: Timeframe.H1,
      strategyId: 'ema-crossover',
      startTime: new Date('2026-01-01T00:00:00.000Z'),
      endTime: new Date('2026-01-01T02:59:59.999Z'),
      initialCapital: 1000,
      feeRate: 0.001,
    });

    expect(result.config.symbol).toBe('BTCUSDT');
    expect(marketDataService.loadCandlesInRange).toHaveBeenCalledOnce();
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('rejects invalid capital', async () => {
    const { service } = createService();

    await expect(
      service.run({
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'ema-crossover',
        startTime: new Date('2026-01-01T00:00:00.000Z'),
        endTime: new Date('2026-01-01T02:59:59.999Z'),
        initialCapital: 0,
        feeRate: 0.001,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid fee rate', async () => {
    const { service } = createService();

    await expect(
      service.run({
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'ema-crossover',
        startTime: new Date('2026-01-01T00:00:00.000Z'),
        endTime: new Date('2026-01-01T02:59:59.999Z'),
        initialCapital: 1000,
        feeRate: 1.5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid dates', async () => {
    const { service } = createService();

    await expect(
      service.run({
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'ema-crossover',
        startTime: new Date('invalid'),
        endTime: new Date('2026-01-01T02:59:59.999Z'),
        initialCapital: 1000,
        feeRate: 0.001,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when no candles are available', async () => {
    const { service, marketDataService } = createService();
    marketDataService.loadCandlesInRange.mockResolvedValue([]);

    await expect(
      service.run({
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'ema-crossover',
        startTime: new Date('2026-01-01T00:00:00.000Z'),
        endTime: new Date('2026-01-01T02:59:59.999Z'),
        initialCapital: 1000,
        feeRate: 0.001,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
