import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/config.js';
import { EntryTimingService } from '../src/modules/scanner/domain/entry-timing/entry-timing.service.js';
import type { Candle } from '../src/modules/market/market.types.js';
import type { MarketAnalysis } from '../src/modules/analysis/analysis.types.js';

function makeCandles(closes: number[], lowOffset = 0.4, highOffset = 0.4): Candle[] {
  const now = Date.now();

  return closes.map((close, index) => ({
    timestamp: now - (closes.length - index) * 15 * 60_000,
    open: close,
    high: close + highOffset,
    low: close - lowOffset,
    close,
    volume: 1_000,
    turnover: close * 1_000,
    isClosed: true
  }));
}

function makeAnalysis(overrides: Partial<MarketAnalysis>): MarketAnalysis {
  return {
    symbol: 'ADAUSDC',
    price: 1,
    change24hPercent: 1,
    volume24h: 100_000,
    turnover24h: 2_000_000,
    timeframe: '15m',
    rangeHigh: 1.1,
    rangeLow: 0.9,
    rangePercent: 22.22,
    support: 0.98,
    resistance: 1.03,
    distanceToSupportPercent: 2,
    distanceToResistancePercent: 3,
    positionInRangePercent: 50,
    volatilityPercent: 1,
    trendDirection: 'UP',
    trendStrength: 1,
    liquidityScore: 80,
    gridScore: 70,
    rejectionReasons: [],
    ...overrides
  };
}

describe('entry timing service', () => {
  const service = new EntryTimingService(loadConfig());

  it('marks strong pump near resistance as WAIT_PULLBACK', () => {
    const analysis1h = makeAnalysis({ timeframe: '1h', trendDirection: 'UP' });
    const analysis15m = makeAnalysis({
      timeframe: '15m',
      trendDirection: 'UP',
      change24hPercent: 9,
      positionInRangePercent: 88,
      distanceToResistancePercent: 1.2
    });

    const output = service.evaluate({
      analysis1h,
      analysis15m,
      candles15m: makeCandles([0.99, 1, 1.005, 1.008, 1.01, 1.012, 1.014, 1.016])
    });

    expect(output.entryTiming).toBe('WAIT_PULLBACK');
    expect(output.entryReasons).toContain('Strong 24h pump with price near range high.');
  });

  it('marks support pullback stabilization as READY', () => {
    const analysis1h = makeAnalysis({ timeframe: '1h', trendDirection: 'UP' });
    const analysis15m = makeAnalysis({
      timeframe: '15m',
      trendDirection: 'SIDEWAYS',
      support: 1,
      resistance: 1.08,
      distanceToSupportPercent: 1,
      distanceToResistancePercent: 4,
      positionInRangePercent: 52
    });

    const output = service.evaluate({
      analysis1h,
      analysis15m,
      candles15m: makeCandles([
        1.06,
        1.04,
        1.03,
        1.02,
        1.01,
        1.005,
        1.007,
        1.009,
        1.01,
        1.012
      ], 0.25, 0.25)
    });

    expect(output.entryTiming).toBe('READY');
    expect(output.entryReasons).toContain('Pullback reached support and price is stabilizing.');
    expect(output.recommendedGridRange).toBeDefined();
  });

  it('marks breakout without retest as WAIT_BREAKOUT_RETEST', () => {
    const analysis1h = makeAnalysis({ timeframe: '1h', trendDirection: 'UP' });
    const analysis15m = makeAnalysis({
      timeframe: '15m',
      trendDirection: 'UP',
      resistance: 1,
      support: 0.85,
      distanceToSupportPercent: 8,
      distanceToResistancePercent: 2.6,
      positionInRangePercent: 80,
      volatilityPercent: 1.2
    });

    const config = {
      ...loadConfig(),
      minAvgRangePercent: 0.6,
      maxAvgRangePercent: 3
    };
    const testService = new EntryTimingService(config);

    const candles: Candle[] = [
      { timestamp: Date.now() - 15 * 15 * 60_000, open: 0.92, high: 0.93, low: 0.91, close: 0.92, volume: 1000, turnover: 920, isClosed: true },
      { timestamp: Date.now() - 14 * 15 * 60_000, open: 0.92, high: 0.93, low: 0.91, close: 0.925, volume: 1000, turnover: 925, isClosed: true },
      { timestamp: Date.now() - 13 * 15 * 60_000, open: 0.925, high: 0.94, low: 0.92, close: 0.93, volume: 1000, turnover: 930, isClosed: true },
      { timestamp: Date.now() - 12 * 15 * 60_000, open: 0.93, high: 0.95, low: 0.92, close: 0.94, volume: 1000, turnover: 940, isClosed: true },
      { timestamp: Date.now() - 11 * 15 * 60_000, open: 0.94, high: 0.96, low: 0.935, close: 0.96, volume: 1000, turnover: 960, isClosed: true },
      { timestamp: Date.now() - 10 * 15 * 60_000, open: 0.96, high: 0.98, low: 0.95, close: 0.975, volume: 1000, turnover: 975, isClosed: true },
      { timestamp: Date.now() - 9 * 15 * 60_000, open: 0.975, high: 0.99, low: 0.97, close: 0.985, volume: 1000, turnover: 985, isClosed: true },
      { timestamp: Date.now() - 8 * 15 * 60_000, open: 0.985, high: 0.995, low: 0.98, close: 0.99, volume: 1000, turnover: 990, isClosed: true },
      { timestamp: Date.now() - 7 * 15 * 60_000, open: 0.99, high: 1.002, low: 0.995, close: 1.0, volume: 1000, turnover: 1000, isClosed: true },
      { timestamp: Date.now() - 6 * 15 * 60_000, open: 1.0, high: 1.008, low: 1.002, close: 1.006, volume: 1000, turnover: 1006, isClosed: true },
      { timestamp: Date.now() - 5 * 15 * 60_000, open: 1.006, high: 1.018, low: 1.008, close: 1.018, volume: 1000, turnover: 1018, isClosed: true },
      { timestamp: Date.now() - 4 * 15 * 60_000, open: 1.018, high: 1.032, low: 1.018, close: 1.032, volume: 1000, turnover: 1032, isClosed: true },
      { timestamp: Date.now() - 3 * 15 * 60_000, open: 1.032, high: 1.045, low: 1.030, close: 1.042, volume: 1000, turnover: 1042, isClosed: true },
      { timestamp: Date.now() - 2 * 15 * 60_000, open: 1.042, high: 1.055, low: 1.040, close: 1.052, volume: 1000, turnover: 1052, isClosed: true },
      { timestamp: Date.now() - 1 * 15 * 60_000, open: 1.052, high: 1.065, low: 1.050, close: 1.062, volume: 1000, turnover: 1062, isClosed: true }
    ];

    const output = testService.evaluate({
      analysis1h,
      analysis15m,
      candles15m: candles
    });

    expect(output.entryTiming).toBe('WAIT_BREAKOUT_RETEST');
  });

  it('marks breakout and successful retest as READY', () => {
    const analysis1h = makeAnalysis({ timeframe: '1h', trendDirection: 'UP' });
    const analysis15m = makeAnalysis({
      timeframe: '15m',
      trendDirection: 'UP',
      resistance: 1,
      support: 0.95,
      distanceToSupportPercent: 3.5,
      distanceToResistancePercent: 2.8,
      positionInRangePercent: 64
    });

    const baseCandles = makeCandles([0.98, 0.99, 0.995, 1.003, 1.012, 1.004, 1.016], 0.03, 0.04);
    const sixthCandle = baseCandles[5];
    if (sixthCandle) {
      baseCandles[5] = {
        timestamp: sixthCandle.timestamp,
        open: 1.0042,
        high: 1.0082,
        low: 1.0005,
        close: 1.0042,
        volume: 1_000,
        turnover: 1_000,
        isClosed: true
      };
    }

    const output = service.evaluate({
      analysis1h,
      analysis15m,
      candles15m: baseCandles
    });

    expect(output.entryTiming).toBe('READY');
    expect(output.entryReasons).toContain('Breakout confirmed and resistance successfully retested.');
  });

  it('blocks entries when 1H trend is DOWN', () => {
    const analysis1h = makeAnalysis({ timeframe: '1h', trendDirection: 'DOWN' });
    const analysis15m = makeAnalysis({ timeframe: '15m', trendDirection: 'UP' });

    const output = service.evaluate({
      analysis1h,
      analysis15m,
      candles15m: makeCandles([1.01, 1.008, 1.006, 1.004, 1.002, 1])
    });

    expect(output.entryTiming).toBe('NO_ENTRY');
    expect(output.entryReasons).toContain('1H trend is bearish.');
  });

  it('returns WAIT_CONFIRMATION in neutral sideways conditions', () => {
    const config = {
      ...loadConfig(),
      minAvgRangePercent: 0.6,
      maxAvgRangePercent: 3
    };
    const neutralService = new EntryTimingService(config);

    const analysis1h = makeAnalysis({ timeframe: '1h', trendDirection: 'SIDEWAYS' });
    const analysis15m = makeAnalysis({
      timeframe: '15m',
      trendDirection: 'SIDEWAYS',
      volatilityPercent: 0.2,
      positionInRangePercent: 48,
      distanceToSupportPercent: 3,
      distanceToResistancePercent: 3
    });

    const output = neutralService.evaluate({
      analysis1h,
      analysis15m,
      candles15m: makeCandles([1, 1.001, 1.0005, 1.0012, 1.0008, 1.001])
    });

    expect(output.entryTiming).toBe('WAIT_CONFIRMATION');
    expect(output.entryReasons).toContain('Current volatility is outside the preferred entry range.');
  });
});
