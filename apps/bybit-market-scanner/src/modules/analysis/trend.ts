import type { Candle } from '../market/market.types.js';
import type { TrendAnalysis, TrendDirection } from './analysis.types.js';
import { round } from '../../shared/utils/math.js';

function calculateEma(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const seedSize = Math.min(period, values.length);
  let ema = values.slice(0, seedSize).reduce((sum, value) => sum + value, 0) / seedSize;
  const alpha = 2 / (period + 1);

  for (let i = seedSize; i < values.length; i += 1) {
    const current = values[i];
    if (current === undefined) continue;
    ema = current * alpha + ema * (1 - alpha);
  }

  return ema;
}

function resolveTrendDirection(
  ema20: number,
  ema50: number,
  priceChangeWindowPercent: number
): TrendDirection {
  if (ema20 > ema50 && priceChangeWindowPercent > 0.5) return 'UP';
  if (ema20 < ema50 && priceChangeWindowPercent < -0.5) return 'DOWN';
  return 'SIDEWAYS';
}

export function analyzeTrend(candles: Candle[]): TrendAnalysis {
  if (candles.length === 0) {
    return {
      trendDirection: 'SIDEWAYS',
      trendStrength: 0,
      priceChangeWindowPercent: 0,
      ema20: 0,
      ema50: 0
    };
  }

  const closes = candles.map((item) => item.close);
  const first = closes[0] ?? 0;
  const last = closes[closes.length - 1] ?? 0;

  const priceChangeWindowPercent = first > 0 ? ((last - first) / first) * 100 : 0;
  const ema20 = calculateEma(closes, 20);
  const ema50 = calculateEma(closes, 50);
  const trendStrength = ema50 > 0 ? Math.abs(((ema20 - ema50) / ema50) * 100) : 0;

  return {
    trendDirection: resolveTrendDirection(ema20, ema50, priceChangeWindowPercent),
    trendStrength: round(trendStrength),
    priceChangeWindowPercent: round(priceChangeWindowPercent),
    ema20: round(ema20),
    ema50: round(ema50)
  };
}
