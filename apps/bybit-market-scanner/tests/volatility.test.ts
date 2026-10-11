import { describe, expect, it } from 'vitest';
import { calculateVolatilityPercent } from '../src/modules/analysis/volatility.js';

describe('volatility', () => {
  it('calculates average candle range percent', () => {
    const candles = [
      { timestamp: 1, open: 10, high: 11, low: 9, close: 10, volume: 1, turnover: 10, isClosed: true },
      { timestamp: 2, open: 10, high: 12, low: 10, close: 11, volume: 1, turnover: 10, isClosed: true }
    ];

    const result = calculateVolatilityPercent(candles);
    const expected = (((11 - 9) / 10) * 100 + ((12 - 10) / 10) * 100) / 2;

    expect(result).toBeCloseTo(expected, 4);
  });

  it('returns zero for a perfectly flat market (no high/low spread)', () => {
    const flat = Array.from({ length: 10 }, (_, index) => ({
      timestamp: index,
      open: 20,
      high: 20,
      low: 20,
      close: 20,
      volume: 1,
      turnover: 20,
      isClosed: true
    }));

    expect(calculateVolatilityPercent(flat)).toBe(0);
  });

  it('is pulled upward by a single outlier wick but stays finite and bounded by the data', () => {
    const withOutlier = [
      { timestamp: 1, open: 10, high: 10.1, low: 9.9, close: 10, volume: 1, turnover: 10, isClosed: true },
      { timestamp: 2, open: 10, high: 10.1, low: 9.9, close: 10, volume: 1, turnover: 10, isClosed: true },
      // Flash-wick candle: momentary spike far outside the normal range.
      { timestamp: 3, open: 10, high: 50, low: 5, close: 10, volume: 1, turnover: 10, isClosed: true },
      { timestamp: 4, open: 10, high: 10.1, low: 9.9, close: 10, volume: 1, turnover: 10, isClosed: true }
    ];

    const result = calculateVolatilityPercent(withOutlier);

    expect(Number.isFinite(result)).toBe(true);
    // The outlier candle alone contributes ((50-5)/10)*100 = 450%; averaged
    // over 4 candles it should dominate but remain well below that raw value.
    expect(result).toBeGreaterThan(100);
    expect(result).toBeLessThan(450);
  });

  it('reflects elevated but steady ranges during a strong sustained trend', () => {
    const trending = Array.from({ length: 10 }, (_, index) => ({
      timestamp: index,
      open: 100 + index,
      high: 102 + index,
      low: 99 + index,
      close: 101 + index,
      volume: 1,
      turnover: 100,
      isClosed: true
    }));

    const result = calculateVolatilityPercent(trending);

    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('ignores zero-open candles instead of producing NaN/Infinity', () => {
    const withZeroOpen = [
      { timestamp: 1, open: 0, high: 5, low: 0, close: 2, volume: 1, turnover: 0, isClosed: true },
      { timestamp: 2, open: 10, high: 11, low: 9, close: 10, volume: 1, turnover: 10, isClosed: true }
    ];

    const result = calculateVolatilityPercent(withZeroOpen);

    expect(result).toBeCloseTo(((11 - 9) / 10) * 100, 4);
  });
});
