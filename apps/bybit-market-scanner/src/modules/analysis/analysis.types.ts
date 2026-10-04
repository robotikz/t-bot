import type {
  MarketAnalysis as SharedMarketAnalysis,
  ScannerTimeframe,
  TrendDirection as SharedTrendDirection
} from '@trading-platform/shared';

export interface PriceLevel {
  price: number;
  touches: number;
  distancePercent: number;
  strength: number;
}

export type TrendDirection = SharedTrendDirection;

export interface TrendAnalysis {
  trendDirection: TrendDirection;
  trendStrength: number;
  priceChangeWindowPercent: number;
  ema20: number;
  ema50: number;
}

export interface MarketAnalysis extends SharedMarketAnalysis {
  timeframe: ScannerTimeframe;
}
