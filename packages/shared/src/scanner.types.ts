export type ScannerTimeframe = '15m' | '1h';

export type CandidateStatus = 'CANDIDATE' | 'WATCH' | 'REJECTED';

export type EntryTimingState =
  | 'READY'
  | 'WAIT_PULLBACK'
  | 'WAIT_BREAKOUT_RETEST'
  | 'WAIT_CONFIRMATION'
  | 'NO_ENTRY';

export type TrendDirection = 'UP' | 'DOWN' | 'SIDEWAYS';

export interface MarketInstrument {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  status: string;
}

export interface MarketTicker {
  symbol: string;
  lastPrice: number;
  change24hPercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  turnover24h: number;
  bidPrice?: number;
  askPrice?: number;
  timestamp: number;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
  isClosed: boolean;
}

export interface MarketAnalysis {
  symbol: string;
  price: number;
  change24hPercent: number;
  volume24h: number;
  turnover24h: number;
  timeframe: ScannerTimeframe;
  rangeHigh: number;
  rangeLow: number;
  rangePercent: number;
  support: number;
  resistance: number;
  distanceToSupportPercent: number;
  distanceToResistancePercent: number;
  positionInRangePercent: number;
  volatilityPercent: number;
  trendDirection: TrendDirection;
  trendStrength: number;
  liquidityScore: number;
  gridScore: number;
  rejectionReasons: string[];
}

export interface ScannerWeights {
  liquidity: number;
  range: number;
  trend: number;
  volatility: number;
  supportResistance: number;
}

export interface EntryZone {
  min: number;
  max: number;
}

export interface RecommendedEntryZone {
  supportBasedEntry: EntryZone;
  breakoutRetestEntry: EntryZone;
}

export interface RecommendedGridRange {
  lower: number;
  upper: number;
}

export interface ScannerCandidate {
  symbol: string;
  score: number;
  status: CandidateStatus;
  market: MarketTicker;
  analysis15m?: MarketAnalysis;
  analysis1h?: MarketAnalysis;
  reasons: string[];
  rejectionReasons: string[];
  entryTiming: EntryTimingState;
  entryScore: number;
  entryReasons: string[];
  recommendedEntryZone: RecommendedEntryZone;
  recommendedGridRange?: RecommendedGridRange;
  recommendedStopLoss?: number;
  recommendedTakeProfit?: number;
  recommendedGrids?: number;
}

export interface ScanResult {
  timestamp: string;
  count: number;
  candidates: ScannerCandidate[];
}
