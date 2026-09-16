import { describe, expect, it, vi } from 'vitest';
import { Timeframe } from '../../brokers/domain/types.js';
import { SignalType } from '../../strategies/domain/signal.js';
import { StrategyRegistry } from '../../strategies/application/strategy-registry.service.js';
import { BacktestEngine } from './backtest-engine.js';

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

function createPlanRegistry(plan: SignalType[]) {
  return {
    evaluate: vi.fn((_strategyId: string, context: { symbol: string; timeframe: Timeframe; candles: Array<{ closeTime: Date; close: number }> }) => {
      const index = context.candles.length - 1;
      const type = plan[index] ?? SignalType.HOLD;
      const latest = context.candles.at(-1)!;

      return {
        strategyId: 'planned',
        symbol: context.symbol,
        timeframe: context.timeframe,
        type,
        timestamp: latest.closeTime,
        price: latest.close,
        reason: 'planned',
      };
    }),
  } as unknown as StrategyRegistry;
}

describe('BacktestEngine', () => {
  it('returns an empty result for empty candles', () => {
    const engine = new BacktestEngine(createPlanRegistry([]));

    const result = engine.run(
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'ema-crossover',
        startTime: new Date('2026-01-01T00:00:00.000Z'),
        endTime: new Date('2026-01-02T00:00:00.000Z'),
        initialCapital: 1000,
        feeRate: 0.001,
      },
      [],
    );

    expect(result.trades).toEqual([]);
    expect(result.equityCurve).toEqual([]);
    expect(result.metrics.finalCapital).toBe(1000);
    expect(result.metrics.winRate).toBeNull();
  });

  it('executes BUY on the next candle open and SELL on the next candle open', () => {
    const engine = new BacktestEngine(createPlanRegistry([SignalType.BUY, SignalType.HOLD, SignalType.SELL, SignalType.HOLD]));

    const result = engine.run(
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'planned',
        startTime: new Date('2026-01-01T00:00:00.000Z'),
        endTime: new Date('2026-01-01T03:59:59.999Z'),
        initialCapital: 1000,
        feeRate: 0.001,
      },
      [createCandle(0, 100), createCandle(1, 105), createCandle(2, 110), createCandle(3, 120)],
    );

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].entryPrice).toBe(105);
    expect(result.trades[0].exitPrice).toBe(120);
    expect(result.trades[0].fees).toBeGreaterThan(0);
    expect(result.trades[0].netPnl).toBeLessThan(result.trades[0].grossPnl);
    expect(result.metrics.finalCapital).toBeGreaterThan(1000);
  });

  it('ignores duplicate BUY signals while already long', () => {
    const engine = new BacktestEngine(createPlanRegistry([SignalType.BUY, SignalType.BUY, SignalType.HOLD]));

    const result = engine.run(
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'planned',
        startTime: new Date('2026-01-01T00:00:00.000Z'),
        endTime: new Date('2026-01-01T02:59:59.999Z'),
        initialCapital: 1000,
        feeRate: 0.001,
      },
      [createCandle(0, 100), createCandle(1, 110), createCandle(2, 120)],
    );

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].entryPrice).toBe(110);
    expect(result.metrics.totalTrades).toBe(1);
  });

  it('ignores SELL while flat', () => {
    const engine = new BacktestEngine(createPlanRegistry([SignalType.SELL, SignalType.HOLD, SignalType.HOLD]));

    const result = engine.run(
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'planned',
        startTime: new Date('2026-01-01T00:00:00.000Z'),
        endTime: new Date('2026-01-01T02:59:59.999Z'),
        initialCapital: 1000,
        feeRate: 0.001,
      },
      [createCandle(0, 100), createCandle(1, 110), createCandle(2, 120)],
    );

    expect(result.trades).toHaveLength(0);
    expect(result.metrics.totalTrades).toBe(0);
  });

  it('supports multiple trades and chronological processing', () => {
    const evaluate = vi.fn((_strategyId: string, context: { candles: Array<{ closeTime: Date; close: number }> }) => {
      const plan: SignalType[] = [SignalType.BUY, SignalType.HOLD, SignalType.SELL, SignalType.BUY, SignalType.SELL, SignalType.HOLD];
      const type = plan[context.candles.length - 1] ?? SignalType.HOLD;
      const latest = context.candles.at(-1)!;

      return {
        strategyId: 'planned',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        type,
        timestamp: latest.closeTime,
        price: latest.close,
        reason: 'planned',
      };
    });

    const engine = new BacktestEngine({ evaluate } as unknown as StrategyRegistry);

    const result = engine.run(
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'planned',
        startTime: new Date('2026-01-01T00:00:00.000Z'),
        endTime: new Date('2026-01-01T05:59:59.999Z'),
        initialCapital: 1000,
        feeRate: 0.001,
      },
      [createCandle(0, 100), createCandle(1, 105), createCandle(2, 110), createCandle(3, 115), createCandle(4, 120), createCandle(5, 125)],
    );

    expect(result.trades).toHaveLength(2);
    expect(evaluate).toHaveBeenCalledTimes(6);
    expect(result.equityCurve).toHaveLength(6);
    expect(result.equityCurve[0].timestamp.getTime()).toBeLessThan(result.equityCurve[5].timestamp.getTime());
  });

  it('forces closure of an open position at the end of the test', () => {
    const engine = new BacktestEngine(createPlanRegistry([SignalType.BUY, SignalType.HOLD, SignalType.HOLD]));

    const result = engine.run(
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'planned',
        startTime: new Date('2026-01-01T00:00:00.000Z'),
        endTime: new Date('2026-01-01T02:59:59.999Z'),
        initialCapital: 1000,
        feeRate: 0.001,
      },
      [createCandle(0, 100), createCandle(1, 110), createCandle(2, 90)],
    );

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitTime.getTime()).toBe(result.equityCurve.at(-1)!.timestamp.getTime());
  });

  it('does not look ahead beyond the current candle', () => {
    const candleLengths: number[] = [];
    const evaluate = vi.fn((_strategyId: string, context: { candles: Array<{ closeTime: Date; close: number }> }) => {
      candleLengths.push(context.candles.length);
      const latest = context.candles.at(-1)!;

      return {
        strategyId: 'planned',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        type: context.candles.length === 1 ? SignalType.BUY : SignalType.HOLD,
        timestamp: latest.closeTime,
        price: latest.close,
        reason: 'planned',
      };
    });

    const engine = new BacktestEngine({ evaluate } as unknown as StrategyRegistry);

    engine.run(
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'planned',
        startTime: new Date('2026-01-01T00:00:00.000Z'),
        endTime: new Date('2026-01-01T02:59:59.999Z'),
        initialCapital: 1000,
        feeRate: 0.001,
      },
      [createCandle(0, 100), createCandle(1, 110), createCandle(2, 120)],
    );

    expect(candleLengths).toEqual([1, 2, 3]);
  });

  it('calculates max drawdown from the equity curve', () => {
    const engine = new BacktestEngine(createPlanRegistry([SignalType.BUY, SignalType.HOLD, SignalType.HOLD, SignalType.HOLD]));

    const result = engine.run(
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        strategyId: 'planned',
        startTime: new Date('2026-01-01T00:00:00.000Z'),
        endTime: new Date('2026-01-01T03:59:59.999Z'),
        initialCapital: 1000,
        feeRate: 0.001,
      },
      [createCandle(0, 100), createCandle(1, 120), createCandle(2, 80), createCandle(3, 90)],
    );

    expect(result.metrics.maxDrawdown).toBeGreaterThan(0);
  });
});
