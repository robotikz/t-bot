import type { Candle } from '../market/market.types.js';
import { ValidationError } from '../../shared/errors/app-error.js';

export function calculateVolatilityPercent(candles: Candle[]): number {
  if (candles.length === 0) return 0;

  let total = 0;
  let count = 0;

  for (const candle of candles) {
    if (![candle.open, candle.high, candle.low].every(Number.isFinite)) {
      throw new ValidationError(
        'MALFORMED_CANDLE',
        'Non-finite open/high/low value in candle data; volatility cannot be computed'
      );
    }
    if (candle.open <= 0) continue;
    total += ((candle.high - candle.low) / candle.open) * 100;
    count += 1;
  }

  if (count === 0) return 0;
  return total / count;
}
