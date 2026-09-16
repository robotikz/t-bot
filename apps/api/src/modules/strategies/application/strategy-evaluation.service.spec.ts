import { describe, expect, it, vi } from 'vitest';
import { Timeframe } from '../../brokers/domain/types.js';
import { StrategyEvaluationService } from './strategy-evaluation.service.js';
import { StrategyRegistry } from './strategy-registry.service.js';
import { StrategyNotFoundException } from './errors/strategy-not-found.exception.js';
import { InsufficientMarketDataException } from './errors/insufficient-market-data.exception.js';

describe('StrategyEvaluationService', () => {
  function createService() {
    const marketDataService = {
      loadCandles: vi.fn(),
    };

    const strategyRegistry = new StrategyRegistry();

    const service = new StrategyEvaluationService(
      marketDataService as never,
      strategyRegistry,
    );

    return {
      service,
      marketDataService,
    };
  }

  it('evaluates a strategy successfully', async () => {
    const { service, marketDataService } = createService();
    marketDataService.loadCandles.mockResolvedValue([
      {
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        openTime: new Date('2026-09-16T00:00:00.000Z'),
        closeTime: new Date('2026-09-16T00:59:59.000Z'),
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        volume: 1,
        isClosed: true,
      },
      {
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        openTime: new Date('2026-09-16T01:00:00.000Z'),
        closeTime: new Date('2026-09-16T01:59:59.000Z'),
        open: 101,
        high: 101,
        low: 101,
        close: 101,
        volume: 1,
        isClosed: true,
      },
    ]);

    const signal = await service.evaluate({
      brokerId: 'bybit',
      symbol: 'BTCUSDT',
      timeframe: Timeframe.H1,
      strategyId: 'rsi',
    });

    expect(signal.strategyId).toBe('rsi');
    expect(marketDataService.loadCandles).toHaveBeenCalledWith({
      brokerId: 'bybit',
      symbol: 'BTCUSDT',
      timeframe: Timeframe.H1,
    });
  });

  it('throws when strategy is not found', async () => {
    const { service, marketDataService } = createService();
    marketDataService.loadCandles.mockResolvedValue([]);

    await expect(
      service.evaluate({
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'missing',
      }),
    ).rejects.toThrow(StrategyNotFoundException);
  });

  it('propagates market data errors', async () => {
    const { service, marketDataService } = createService();
    marketDataService.loadCandles.mockRejectedValue(new Error('market down'));

    await expect(
      service.evaluate({
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'rsi',
      }),
    ).rejects.toThrow('market down');
  });

  it('throws insufficient market data when no candles are returned', async () => {
    const { service, marketDataService } = createService();
    marketDataService.loadCandles.mockResolvedValue([]);

    await expect(
      service.evaluate({
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'rsi',
      }),
    ).rejects.toThrow(InsufficientMarketDataException);
  });
});
