import { describe, expect, it } from 'vitest';
import { calculateSupportResistance } from '../src/modules/analysis/support-resistance.js';

const candles = [
  { timestamp: 1, open: 100, high: 106, low: 97, close: 102, volume: 1, turnover: 1, isClosed: true },
  { timestamp: 2, open: 102, high: 105, low: 98, close: 103, volume: 1, turnover: 1, isClosed: true },
  { timestamp: 3, open: 103, high: 108, low: 99, close: 104, volume: 1, turnover: 1, isClosed: true },
  { timestamp: 4, open: 104, high: 104, low: 96, close: 100, volume: 1, turnover: 1, isClosed: true },
  { timestamp: 5, open: 100, high: 107, low: 99, close: 105, volume: 1, turnover: 1, isClosed: true },
  { timestamp: 6, open: 105, high: 110, low: 100, close: 106, volume: 1, turnover: 1, isClosed: true },
  { timestamp: 7, open: 106, high: 109, low: 99, close: 103, volume: 1, turnover: 1, isClosed: true },
  { timestamp: 8, open: 103, high: 111, low: 101, close: 108, volume: 1, turnover: 1, isClosed: true }
];

describe('support-resistance', () => {
  it('returns support/resistance around current price', () => {
    const result = calculateSupportResistance(candles, 104, {
      swingWindow: 1,
      clusterPercent: 1.5,
      minTouches: 1
    });

    expect(result.support).toBeLessThanOrEqual(104);
    expect(result.resistance).toBeGreaterThanOrEqual(104);
    expect(result.distanceToSupportPercent).toBeGreaterThanOrEqual(0);
    expect(result.distanceToResistancePercent).toBeGreaterThanOrEqual(0);
  });
});
