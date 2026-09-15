import { Market, Candle, Instrument } from './types.js';
import { Timeframe } from '../../../common/enums.js';

export interface MarketDataProvider {
  getMarkets(): Promise<Market[]>;
  getInstrument(symbol: string): Promise<Instrument | null>;
  getCandles(symbol: string, timeframe: Timeframe, limit?: number): Promise<Candle[]>;
}
