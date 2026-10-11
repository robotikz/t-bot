import { describe, expect, it } from 'vitest';
import { calculateRangeMetrics } from '../src/modules/analysis/range.js';

const candles = [
  { timestamp: 1, open: 10, high: 12, low: 9, close: 11, volume: 1, turnover: 10, isClosed: true },
  { timestamp: 2, open: 11, high: 13, low: 10, close: 12, volume: 1, turnover: 10, isClosed: true },
  { timestamp: 3, open: 12, high: 14, low: 10, close: 13, volume: 1, turnover: 10, isClosed: true }
];

describe('range', () => {
  it('calculates high/low/range/position', () => {
    const result = calculateRangeMetrics(candles, 12);

    expect(result.rangeHigh).toBe(14);
    expect(result.rangeLow).toBe(9);
    expect(result.rangePercent).toBeCloseTo(55.5556, 3);
    expect(result.positionInRangePercent).toBe(60);
  });

  it('collapses to a zero-width range on a perfectly flat market', () => {
    const flat = Array.from({ length: 10 }, (_, index) => ({
      timestamp: index,
      open: 50,
      high: 50,
      low: 50,
      close: 50,
      volume: 1,
      turnover: 50,
      isClosed: true
    }));

    const result = calculateRangeMetrics(flat, 50);

    expect(result.rangeHigh).toBe(50);
    expect(result.rangeLow).toBe(50);
    expect(result.rangePercent).toBe(0);
    // Zero-width range: position is defined as neutral (50), not a divide-by-zero.
    expect(result.positionInRangePercent).toBe(50);
  });

  it('is dominated by a single outlier wick without throwing or producing NaN', () => {
    const withOutlier = [
      { timestamp: 1, open: 10, high: 10.5, low: 9.5, close: 10, volume: 1, turnover: 10, isClosed: true },
      { timestamp: 2, open: 10, high: 10.2, low: 9.8, close: 10, volume: 1, turnover: 10, isClosed: true },
      // Flash-wick candle: momentary spike far outside the normal range.
      { timestamp: 3, open: 10, high: 1000, low: 0.01, close: 10, volume: 1, turnover: 10, isClosed: true },
      { timestamp: 4, open: 10, high: 10.3, low: 9.7, close: 10, volume: 1, turnover: 10, isClosed: true }
    ];

    const result = calculateRangeMetrics(withOutlier, 10);

    expect(result.rangeHigh).toBe(1000);
    expect(result.rangeLow).toBe(0.01);
    expect(Number.isFinite(result.rangePercent)).toBe(true);
    expect(result.rangePercent).toBeGreaterThan(0);
  });

  it('places price near the top of range during a strong sustained uptrend', () => {
    const uptrend = Array.from({ length: 15 }, (_, index) => ({
      timestamp: index,
      open: 100 + index,
      high: 101 + index,
      low: 99 + index,
      close: 100.5 + index,
      volume: 1,
      turnover: 100,
      isClosed: true
    }));

    // Current price sits at (near) the most recent high of the trend.
    const result = calculateRangeMetrics(uptrend, 114);

    expect(result.rangeHigh).toBe(115);
    expect(result.rangeLow).toBe(99);
    expect(result.positionInRangePercent).toBeGreaterThan(85);
  });
});
