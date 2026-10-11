import { describe, expect, it } from 'vitest';
import { calculateRangeMetrics } from '../src/modules/analysis/range.js';
import { calculateSupportResistance } from '../src/modules/analysis/support-resistance.js';
import { calculateVolatilityPercent } from '../src/modules/analysis/volatility.js';
import type { Candle } from '../src/modules/market/market.types.js';

function c(open: number, high: number, low: number, close = open): Candle {
  return { timestamp: 0, open, high, low, close, volume: 1, turnover: 1, isClosed: true };
}

const opts = { swingWindow: 1, clusterPercent: 1, minTouches: 1 };

describe('range edge cases', () => {
  const band = Array.from({ length: 6 }, () => c(100, 110, 90));

  it('clamps position to 0 when price is below the range (out-of-range is hidden by design)', () => {
    const r = calculateRangeMetrics(band, 80);
    expect(r.positionInRangePercent).toBe(0);
    expect(r.rangeLow).toBe(90);
    // rangeLow/rangeHigh remain exposed, so consumers can detect price < rangeLow.
  });

  it('clamps position to 100 when price is above the range', () => {
    const r = calculateRangeMetrics(band, 120);
    expect(r.positionInRangePercent).toBe(100);
    expect(r.rangeHigh).toBe(110);
  });

  it('returns a zero-width range for empty candles', () => {
    const r = calculateRangeMetrics([], 100);
    expect(r).toEqual({
      rangeHigh: 100,
      rangeLow: 100,
      rangePercent: 0,
      positionInRangePercent: 50,
      priceVsRange: 'WITHIN_RANGE'
    });
  });

  it('exposes the unclamped out-of-range condition via priceVsRange', () => {
    expect(calculateRangeMetrics(band, 80).priceVsRange).toBe('BELOW_RANGE');
    expect(calculateRangeMetrics(band, 120).priceVsRange).toBe('ABOVE_RANGE');
    expect(calculateRangeMetrics(band, 90).priceVsRange).toBe('WITHIN_RANGE');
    expect(calculateRangeMetrics(band, 110).priceVsRange).toBe('WITHIN_RANGE');
  });

  it('returns rangePercent 0 when the low is non-positive', () => {
    const r = calculateRangeMetrics([c(1, 2, 0)], 1);
    expect(r.rangePercent).toBe(0);
  });

  it('a single extreme wick inflates rangePercent enormously (documented assumption)', () => {
    const withWick = [...band, c(100, 110, 1)];
    expect(calculateRangeMetrics(band, 100).rangePercent).toBeCloseTo(22.2222, 3);
    expect(calculateRangeMetrics(withWick, 100).rangePercent).toBeGreaterThan(1000);
  });
});

describe('support/resistance ordering', () => {
  const lowBand = Array.from({ length: 10 }, () => c(100, 102, 98));

  it('never returns support above price when price is below all candle lows', () => {
    const r = calculateSupportResistance(lowBand, 90, opts);
    expect(r.support).toBeLessThanOrEqual(90);
    expect(r.resistance).toBeGreaterThanOrEqual(90);
  });

  it('never returns resistance below price when price is above all candle highs', () => {
    const r = calculateSupportResistance(lowBand, 120, opts);
    expect(r.support).toBeLessThanOrEqual(120);
    expect(r.resistance).toBeGreaterThanOrEqual(120);
  });

  it('returns price for empty candles', () => {
    const r = calculateSupportResistance([], 100, opts);
    expect(r).toEqual({
      support: 100,
      resistance: 100,
      distanceToSupportPercent: 0,
      distanceToResistancePercent: 0
    });
  });

  it.each([0, -5])('returns the invalid price unchanged for price %s', (price) => {
    const r = calculateSupportResistance(lowBand, price, opts);
    expect(r.support).toBe(price);
    expect(r.resistance).toBe(price);
    expect(r.distanceToSupportPercent).toBe(0);
  });

  it('keeps support <= price <= resistance for ordinary data', () => {
    const r = calculateSupportResistance(lowBand, 100, opts);
    expect(r.support).toBeLessThanOrEqual(100);
    expect(r.resistance).toBeGreaterThanOrEqual(100);
  });

  it('ignores a single isolated wick in the median fallback', () => {
    const candles = [...lowBand, c(100, 500, 1)];
    const r = calculateSupportResistance(candles, 100, { ...opts, minTouches: 99 });
    expect(r.support).toBe(98);
    expect(r.resistance).toBe(102);
  });
});

describe('volatility input validation', () => {
  it.each([
    ['NaN high', c(10, Number.NaN, 9)],
    ['Infinity high', c(10, Number.POSITIVE_INFINITY, 9)],
    ['-Infinity low', c(10, 11, Number.NEGATIVE_INFINITY)],
    ['NaN open', c(Number.NaN, 11, 9)],
    ['Infinity open', c(Number.POSITIVE_INFINITY, 11, 9)]
  ])('throws on %s instead of returning a valid-looking number', (_name, bad) => {
    expect(() => calculateVolatilityPercent([c(10, 11, 9), bad])).toThrow(/Non-finite/);
  });

  it('returns 0 for empty candles and for only non-positive opens', () => {
    expect(calculateVolatilityPercent([])).toBe(0);
    expect(calculateVolatilityPercent([c(0, 5, 0), c(-1, 5, 0)])).toBe(0);
  });

  it('skips negative-open candles', () => {
    expect(calculateVolatilityPercent([c(-10, 50, 0), c(10, 11, 9)])).toBeCloseTo(20, 4);
  });
});
