import type {
  Candle as SharedCandle,
  MarketInstrument as SharedMarketInstrument,
  MarketTicker as SharedMarketTicker,
  ScannerTimeframe
} from '@trading-platform/shared';

export type Timeframe = ScannerTimeframe;

export type MarketInstrument = SharedMarketInstrument;

export type MarketTicker = SharedMarketTicker;

export type Candle = SharedCandle;
