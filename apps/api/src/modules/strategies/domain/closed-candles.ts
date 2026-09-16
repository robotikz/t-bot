import { Candle } from '../../brokers/domain/types.js';

export function getClosedCandles(candles: Candle[]): Candle[] {
  const now = Date.now();

  return candles
    .filter((candle) => candle.isClosed === true || candle.closeTime.getTime() <= now)
    .sort((left, right) => left.openTime.getTime() - right.openTime.getTime());
}
