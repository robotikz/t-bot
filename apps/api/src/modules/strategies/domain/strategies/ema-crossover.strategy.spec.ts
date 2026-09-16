import { describe, expect, it } from 'vitest';
import { Timeframe, type Candle } from '../../../brokers/domain/types.js';
import { IndicatorEngine } from '../indicator-engine.js';
import { SignalType } from '../signal.js';
import { EmaCrossoverStrategy } from './ema-crossover.strategy.js';

function createCandle(openTime: string, closeTime: string, close: number, isClosed = true): Candle {
  return {
    symbol: 'BTCUSDT',
    timeframe: Timeframe.H1,
    openTime: new Date(openTime),
    closeTime: new Date(closeTime),
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
    isClosed,
  };
}

describe('EmaCrossoverStrategy', () => {
  it('returns BUY when fast EMA crosses above slow EMA', () => {
    const strategy = new EmaCrossoverStrategy(new IndicatorEngine(), 2, 3);
    const candles = [1, 1, 1, 1, 4].map((close, index) =>
      createCandle(
        `2026-09-16T0${index}:00:00.000Z`,
        `2026-09-16T0${index}:59:59.000Z`,
        close,
      ),
    );

    const signal = strategy.evaluate({ symbol: 'BTCUSDT', timeframe: Timeframe.H1, candles });

    expect(signal.type).toBe(SignalType.BUY);
    expect(signal.reason).toBe('Fast EMA crossed above slow EMA');
    expect(signal.indicators?.emaFast).not.toBeNull();
    expect(signal.indicators?.emaSlow).not.toBeNull();
  });

  it('returns SELL when fast EMA crosses below slow EMA', () => {
    const strategy = new EmaCrossoverStrategy(new IndicatorEngine(), 2, 3);
    const candles = [4, 4, 4, 4, 1].map((close, index) =>
      createCandle(
        `2026-09-16T0${index}:00:00.000Z`,
        `2026-09-16T0${index}:59:59.000Z`,
        close,
      ),
    );

    const signal = strategy.evaluate({ symbol: 'BTCUSDT', timeframe: Timeframe.H1, candles });

    expect(signal.type).toBe(SignalType.SELL);
    expect(signal.reason).toBe('Fast EMA crossed below slow EMA');
  });

  it('returns HOLD when there is no crossover', () => {
    const strategy = new EmaCrossoverStrategy(new IndicatorEngine(), 2, 3);
    const candles = [1, 2, 3, 4, 5].map((close, index) =>
      createCandle(
        `2026-09-16T0${index}:00:00.000Z`,
        `2026-09-16T0${index}:59:59.000Z`,
        close,
      ),
    );

    const signal = strategy.evaluate({ symbol: 'BTCUSDT', timeframe: Timeframe.H1, candles });

    expect(signal.type).toBe(SignalType.HOLD);
    expect(signal.reason).toBe('No EMA crossover detected');
  });

  it('returns HOLD for insufficient data', () => {
    const strategy = new EmaCrossoverStrategy(new IndicatorEngine(), 9, 21);
    const candles = [1, 2, 3].map((close, index) =>
      createCandle(
        `2026-09-16T0${index}:00:00.000Z`,
        `2026-09-16T0${index}:59:59.000Z`,
        close,
      ),
    );

    const signal = strategy.evaluate({ symbol: 'BTCUSDT', timeframe: Timeframe.H1, candles });

    expect(signal.type).toBe(SignalType.HOLD);
    expect(signal.reason).toContain('Insufficient closed candles');
  });

  it('ignores a forming candle for crossover evaluation', () => {
    const strategy = new EmaCrossoverStrategy(new IndicatorEngine(), 2, 3);
    const candles: Candle[] = [
      createCandle('2026-09-16T00:00:00.000Z', '2026-09-16T00:59:59.000Z', 4, true),
      createCandle('2026-09-16T01:00:00.000Z', '2026-09-16T01:59:59.000Z', 4, true),
      createCandle('2026-09-16T02:00:00.000Z', '2026-09-16T02:59:59.000Z', 4, true),
      createCandle('2026-09-16T03:00:00.000Z', '2026-09-16T03:59:59.000Z', 4, true),
      createCandle('2026-09-16T04:00:00.000Z', '2099-09-16T04:59:59.000Z', 1, false),
    ];

    const signal = strategy.evaluate({ symbol: 'BTCUSDT', timeframe: Timeframe.H1, candles });

    expect(signal.type).toBe(SignalType.HOLD);
    expect(signal.reason).toBe('No EMA crossover detected');
    expect(signal.price).toBe(4);
  });
});
