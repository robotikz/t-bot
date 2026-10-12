import type {
  CandidateStatus,
  EntryTimingState,
  MarketInstrument,
  TrendDirection
} from '@trading-platform/shared';

export type BacktestTimeframe = '15m' | '1h';

export const TIMEFRAME_MS: Record<BacktestTimeframe, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000
};

export const BYBIT_INTERVAL: Record<BacktestTimeframe, string> = {
  '15m': '15',
  '1h': '60'
};

export const BACKTEST_TIMEFRAMES: readonly BacktestTimeframe[] = ['15m', '1h'];

/** Stored candle. By construction every stored candle is closed at the dataset cutoff. */
export interface RawCandle {
  timestamp: number; // candle open time, epoch ms UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

export interface SeriesGap {
  /** Timestamp of the last candle present before the gap. */
  afterTimestamp: number;
  /** Timestamp of the first candle present after the gap. */
  beforeTimestamp: number;
  missingCount: number;
}

export interface SeriesQuality {
  requestedStartMs: number;
  cutoffMs: number;
  expectedCount: number;
  actualCount: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
  /** Candles missing between requestedStartMs and the first candle returned (e.g. pair listed later). */
  headMissingCount: number;
  /** Candles missing between the last candle returned and the cutoff. */
  tailMissingCount: number;
  gaps: SeriesGap[];
  missingInGapsCount: number;
  duplicatesRemoved: number;
  conflictingDuplicates: number;
  misalignedDropped: number;
  incompleteExcluded: number;
  outOfWindowDropped: number;
  pages: number;
  coverageRatio: number;
}

export interface CandleSeries {
  symbol: string;
  timeframe: BacktestTimeframe;
  candles: RawCandle[];
  quality: SeriesQuality;
}

export interface HistoricalSeriesSet {
  '15m': readonly RawCandle[];
  '1h': readonly RawCandle[];
}

export interface HistoricalDataset {
  quoteCoin: string;
  startMs: number;
  cutoffMs: number;
  instruments: MarketInstrument[];
  series: Map<string, HistoricalSeriesSet>;
  seriesQuality: Map<string, Record<BacktestTimeframe, SeriesQuality>>;
  excludedSymbols: Array<{ symbol: string; reason: string }>;
}

export type RangeOutcome = 'INSIDE' | 'BROKE_BELOW' | 'BROKE_ABOVE' | 'INSUFFICIENT_FUTURE';

export interface HorizonOutcome {
  outcome: RangeOutcome;
  observedCandles: number;
  expectedCandles: number;
  missingCandles: number;
  /** Max excursion below range low across the observed window, in % of range low (0 if none). */
  maxDownsidePercent: number;
  /** Max excursion above range high across the observed window, in % of range high (0 if none). */
  maxUpsidePercent: number;
  firstBreakAfterMs: number | null;
  /** First breaking candle pierced both bounds; classified conservatively as BROKE_BELOW. */
  ambiguousSameCandle: boolean;
}

export type ObservationKind =
  | 'SCANNED'
  | 'PREFILTERED_LOW_TURNOVER'
  | 'UNRESOLVED_INVALID_DATA'
  | 'EXCLUDED_NO_TICKER';

export interface ObservationRange {
  low: number;
  high: number;
  widthPercent: number;
}

export interface Observation {
  symbol: string;
  asOfMs: number;
  asOf: string;
  kind: ObservationKind;
  exclusionReason: string | null;
  status: CandidateStatus | null;
  score: number | null;
  rejectionReasons: string[];
  price: number | null;
  turnover24h: number | null;
  change24hPercent: number | null;
  range: ObservationRange | null;
  volatility1hPercent: number | null;
  volatility15mPercent: number | null;
  trend1h: TrendDirection | null;
  trend15m: TrendDirection | null;
  trendStrength1h: number | null;
  support1h: number | null;
  resistance1h: number | null;
  support15m: number | null;
  resistance15m: number | null;
  entryTiming: EntryTimingState | null;
  entryScore: number | null;
  recommendedGridRange: { lower: number; upper: number } | null;
  /** Outcomes of the scanner's 1h range (range.low/high). */
  horizons: Record<string, HorizonOutcome> | null;
  /** Outcomes of recommendedGridRange; only present when entry timing is READY. */
  gridRangeHorizons: Record<string, HorizonOutcome> | null;
  /** Unfiltered baseline: same range function, same window, same timestamp, any symbol with a ticker. */
  baselineRange: ObservationRange | null;
  baselineHorizons: Record<string, HorizonOutcome> | null;
  /** Missing candles inside the analysis window the scanner saw (reported, never filled). */
  missing1hInWindow: number | null;
  missing15mInWindow: number | null;
}
