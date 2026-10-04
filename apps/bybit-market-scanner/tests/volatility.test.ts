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
});
