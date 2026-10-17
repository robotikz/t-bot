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

  it('falls back to the min/max range on a perfectly flat market with no swing points', () => {
    const flat = Array.from({ length: 10 }, (_, index) => ({
      timestamp: index,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1,
      turnover: 1,
      isClosed: true
    }));

    const result = calculateSupportResistance(flat, 100, {
      swingWindow: 1,
      clusterPercent: 1,
      minTouches: 1
    });

    expect(result.support).toBe(100);
    expect(result.resistance).toBe(100);
    expect(result.distanceToSupportPercent).toBe(0);
    expect(result.distanceToResistancePercent).toBe(0);
  });

  it('does not let a single outlier wick get treated as a valid cluster level', () => {
    const withOutlier = [
      { timestamp: 1, open: 100, high: 102, low: 98, close: 100, volume: 1, turnover: 1, isClosed: true },
      { timestamp: 2, open: 100, high: 103, low: 97, close: 101, volume: 1, turnover: 1, isClosed: true },
      // Flash-wick outlier far above/below the normal trading band.
      { timestamp: 3, open: 100, high: 500, low: 1, close: 100, volume: 1, turnover: 1, isClosed: true },
      { timestamp: 4, open: 100, high: 102, low: 98, close: 100, volume: 1, turnover: 1, isClosed: true },
      { timestamp: 5, open: 100, high: 103, low: 97, close: 101, volume: 1, turnover: 1, isClosed: true }
    ];

    // minTouches: 2 ensures a single-touch outlier swing cannot form a cluster level.
    const result = calculateSupportResistance(withOutlier, 100, {
      swingWindow: 1,
      clusterPercent: 1,
      minTouches: 2
    });

    expect(result.support).not.toBe(1);
    expect(result.resistance).not.toBe(500);
  });

  it('reports zero resistance distance when a strong trend breaks to new highs with no established resistance', () => {
    const uptrend = Array.from({ length: 15 }, (_, index) => ({
      timestamp: index,
      open: 100 + index,
      high: 101 + index,
      low: 99 + index,
      close: 100.5 + index,
      volume: 1,
      turnover: 1,
      isClosed: true
    }));

    // Price is at a fresh all-time high for this window: no historical
    // level above it exists, so resistance distance is legitimately zero
    // rather than collapsing to a stale/lower historical level.
    const result = calculateSupportResistance(uptrend, 113, {
      swingWindow: 1,
      clusterPercent: 1,
      minTouches: 1
    });

    expect(result.support).toBeLessThanOrEqual(113);
    expect(result.distanceToResistancePercent).toBe(0);
    expect(Number.isFinite(result.distanceToResistancePercent)).toBe(true);
  });

  it('preserves tiny positive support/resistance values instead of collapsing them to zero', () => {
    const tiny = [
      { timestamp: 1, open: 0.0000041, high: 0.00000418, low: 0.000004, close: 0.00000412, volume: 1, turnover: 1, isClosed: true },
      { timestamp: 2, open: 0.00000412, high: 0.0000043, low: 0.00000402, close: 0.00000425, volume: 1, turnover: 1, isClosed: true },
      { timestamp: 3, open: 0.00000405, high: 0.00000422, low: 0.00000399, close: 0.00000405, volume: 1, turnover: 1, isClosed: true },
      { timestamp: 4, open: 0.0000042, high: 0.00000432, low: 0.00000401, close: 0.0000042, volume: 1, turnover: 1, isClosed: true },
      { timestamp: 5, open: 0.00000415, high: 0.00000435, low: 0.00000403, close: 0.0000043, volume: 1, turnover: 1, isClosed: true },
      { timestamp: 6, open: 0.00000418, high: 0.00000431, low: 0.00000407, close: 0.00000415, volume: 1, turnover: 1, isClosed: true }
    ];

    const result = calculateSupportResistance(tiny, 0.000004095, {
      swingWindow: 1,
      clusterPercent: 1,
      minTouches: 1
    });

    expect(result.support).toBeGreaterThan(0);
    expect(result.resistance).toBeGreaterThan(result.support);
    expect(result.support).not.toBe(0);
    expect(result.resistance).not.toBe(0);
  });
});
