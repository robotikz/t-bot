import { describe, expect, it } from 'vitest';
import { analyzeTrend } from '../src/modules/analysis/trend.js';

function makeCandles(length: number, start: number, delta: number) {
  return Array.from({ length }, (_, index) => {
    const close = start + index * delta;
    return {
      timestamp: index,
      open: close,
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume: 1,
      turnover: close,
      isClosed: true
    };
  });
}

describe('trend', () => {
  it('detects up trend', () => {
    const result = analyzeTrend(makeCandles(80, 100, 1));
    expect(result.trendDirection).toBe('UP');
    expect(result.trendStrength).toBeGreaterThan(0);
  });

  it('detects down trend', () => {
    const result = analyzeTrend(makeCandles(80, 180, -1));
    expect(result.trendDirection).toBe('DOWN');
    expect(result.trendStrength).toBeGreaterThan(0);
  });

  it('detects sideways trend', () => {
    const result = analyzeTrend(makeCandles(80, 100, 0));
    expect(result.trendDirection).toBe('SIDEWAYS');
    expect(result.trendStrength).toBe(0);
  });
});
