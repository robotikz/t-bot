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
});
