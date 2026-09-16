import { Timeframe } from '../../common/enums.js';

export const MARKET_DATA_PUBLIC_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

export type MarketDataPublicTimeframe = (typeof MARKET_DATA_PUBLIC_TIMEFRAMES)[number];

export const MARKET_DATA_PUBLIC_TIMEFRAME_TO_DOMAIN_TIMEFRAME: Record<MarketDataPublicTimeframe, Timeframe> = {
  '1m': Timeframe.M1,
  '5m': Timeframe.M5,
  '15m': Timeframe.M15,
  '1h': Timeframe.H1,
  '4h': Timeframe.H4,
  '1d': Timeframe.D1,
};

export const MARKET_DATA_DEFAULT_PAGE_SIZE = 250;
