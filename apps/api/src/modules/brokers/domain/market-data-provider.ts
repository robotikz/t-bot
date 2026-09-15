import { Market, Candle, SymbolInfo } from './types.js';
import { Timeframe } from '../../../common/enums.js';

export interface MarketDataProvider {
  getMarkets(): Promise<Market[]>;
  getCandles(symbol: string, timeframe: Timeframe, limit?: number): Promise<Candle[]>;
  getSymbol?(symbol: string): Promise<SymbolInfo | null>;
}
