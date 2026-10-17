import type { Candle } from '../market/market.types.js';
import { clamp } from '../../shared/utils/math.js';

export interface RangeMetrics {
  rangeHigh: number;
  rangeLow: number;
  rangePercent: number;
  positionInRangePercent: number;
  priceVsRange: 'BELOW_RANGE' | 'WITHIN_RANGE' | 'ABOVE_RANGE';
}

export function calculateRangeMetrics(candles: Candle[], price: number): RangeMetrics {
  if (candles.length === 0) {
    return {
      rangeHigh: price,
      rangeLow: price,
      rangePercent: 0,
      positionInRangePercent: 50,
      priceVsRange: 'WITHIN_RANGE'
    };
  }

  let rangeHigh = Number.NEGATIVE_INFINITY;
  let rangeLow = Number.POSITIVE_INFINITY;

  for (const candle of candles) {
    if (candle.high > rangeHigh) rangeHigh = candle.high;
    if (candle.low < rangeLow) rangeLow = candle.low;
  }

  const span = rangeHigh - rangeLow;
  const rangePercent = rangeLow > 0 ? (span / rangeLow) * 100 : 0;

  const positionInRangePercent =
    span > 0 ? clamp(((price - rangeLow) / span) * 100, 0, 100) : 50;

  return {
    rangeHigh,
    rangeLow,
    rangePercent,
    positionInRangePercent,
    priceVsRange: price < rangeLow ? 'BELOW_RANGE' : price > rangeHigh ? 'ABOVE_RANGE' : 'WITHIN_RANGE'
  };
}
