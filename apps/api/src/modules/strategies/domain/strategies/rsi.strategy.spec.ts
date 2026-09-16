import { describe, expect, it } from 'vitest';
import { Timeframe, type Candle } from '../../../brokers/domain/types.js';
import { IndicatorEngine } from '../indicator-engine.js';
import { SignalType } from '../signal.js';
import { RsiStrategy } from './rsi.strategy.js';

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

describe('RsiStrategy', () => {
  it('returns BUY when RSI is below oversold threshold', () => {
    const strategy = new RsiStrategy(new IndicatorEngine(), 3, 30, 70);
    const candles = [6, 5, 4, 3, 2, 1].map((close, index) =>
      createCandle(
        `2026-09-16T0${index}:00:00.000Z`,
        `2026-09-16T0${index}:59:59.000Z`,
        close,
      ),
    );

    const signal = strategy.evaluate({ symbol: 'BTCUSDT', timeframe: Timeframe.H1, candles });

    expect(signal.type).toBe(SignalType.BUY);
    expect(signal.reason).toBe('RSI is at or below the oversold threshold');
  });

  it('returns SELL when RSI is above overbought threshold', () => {
    const strategy = new RsiStrategy(new IndicatorEngine(), 3, 30, 70);
    const candles = [1, 2, 3, 4, 5, 6].map((close, index) =>
      createCandle(
        `2026-09-16T0${index}:00:00.000Z`,
        `2026-09-16T0${index}:59:59.000Z`,
        close,
      ),
    );

    const signal = strategy.evaluate({ symbol: 'BTCUSDT', timeframe: Timeframe.H1, candles });

    expect(signal.type).toBe(SignalType.SELL);
    expect(signal.reason).toBe('RSI is at or above the overbought threshold');
  });

  it('returns HOLD when RSI is neutral', () => {
    const strategy = new RsiStrategy(new IndicatorEngine(), 3, 30, 70);
    const candles = [1, 2, 3, 2, 1].map((close, index) =>
      createCandle(
        `2026-09-16T0${index}:00:00.000Z`,
        `2026-09-16T0${index}:59:59.000Z`,
        close,
      ),
    );

    const signal = strategy.evaluate({ symbol: 'BTCUSDT', timeframe: Timeframe.H1, candles });

    expect(signal.type).toBe(SignalType.HOLD);
    expect(signal.reason).toBe('RSI is in the neutral range');
  });

  it('returns HOLD when RSI cannot be calculated yet', () => {
    const strategy = new RsiStrategy(new IndicatorEngine(), 14, 30, 70);
    const candles = [1, 2, 3, 4].map((close, index) =>
      createCandle(
        `2026-09-16T0${index}:00:00.000Z`,
        `2026-09-16T0${index}:59:59.000Z`,
        close,
      ),
    );

    const signal = strategy.evaluate({ symbol: 'BTCUSDT', timeframe: Timeframe.H1, candles });

    expect(signal.type).toBe(SignalType.HOLD);
    expect(signal.reason).toContain('Insufficient closed candles');
    expect(signal.indicators?.rsi).toBeNull();
  });

  it('ignores forming candle and uses latest closed candle RSI', () => {
    const strategy = new RsiStrategy(new IndicatorEngine(), 3, 30, 70);
    const candles: Candle[] = [
      createCandle('2026-09-16T00:00:00.000Z', '2026-09-16T00:59:59.000Z', 1, true),
      createCandle('2026-09-16T01:00:00.000Z', '2026-09-16T01:59:59.000Z', 2, true),
      createCandle('2026-09-16T02:00:00.000Z', '2026-09-16T02:59:59.000Z', 3, true),
      createCandle('2026-09-16T03:00:00.000Z', '2026-09-16T03:59:59.000Z', 2, true),
      createCandle('2026-09-16T04:00:00.000Z', '2099-09-16T04:59:59.000Z', 10, false),
    ];

    const signal = strategy.evaluate({ symbol: 'BTCUSDT', timeframe: Timeframe.H1, candles });

    expect(signal.type).toBe(SignalType.HOLD);
    expect(signal.price).toBe(2);
  });
});
