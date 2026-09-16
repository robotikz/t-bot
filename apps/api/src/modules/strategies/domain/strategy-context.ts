import { Candle, Timeframe } from '../../brokers/domain/types.js';

export interface StrategyContext {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
}
