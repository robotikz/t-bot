export type SignalState =
  | 'WATCH'
  | 'SETUP_FORMING'
  | 'READY'
  | 'INVALIDATED'
  | 'NO_TRADE';

export type MarketTrend = 'BULLISH' | 'SIDEWAYS' | 'BEARISH';

export type MarketMomentum =
  | 'STRONG_BULLISH'
  | 'BULLISH'
  | 'NEUTRAL'
  | 'BEARISH'
  | 'STRONG_BEARISH';

export interface TimeframeAnalysis {
  trend: MarketTrend;
  ema20?: number;
  ema50?: number;
  support?: number;
  resistance?: number;
  rangeLow?: number;
  rangeHigh?: number;
  rangePercent?: number;
  positionInRange?: number;
  volatility?: number;
  trendStrength?: number;
  higherLow?: boolean;
  lowerHigh?: boolean;
  breakout?: boolean;
  retest?: boolean;
  supportHeld?: boolean;
  stabilizing?: boolean;
  momentum?: MarketMomentum;
}

export interface MarketStructureAnalysis {
  timeframe4h: TimeframeAnalysis;
  timeframe1h: TimeframeAnalysis;
  timeframe15m: TimeframeAnalysis;
}

export type GridRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface GridBotSetup {
  entryLow: number;
  entryHigh: number;
  gridLow: number;
  gridHigh: number;
  gridCount: number;
  stopLoss: number;
  takeProfit: number;
  trailingStopPercent: number;
  trailingUp: boolean;
  investment: number;
  risk: GridRisk;
  confidence: number;
  distanceToResistancePercent: number;
  distanceToInvalidationPercent: number;
}

export type PairValidationStatus = 'USDC_READY' | 'MANUAL_CHECK_REQUIRED';

export interface PairValidation {
  status: PairValidationStatus;
}

export type AiSignalState = 'READY' | 'WATCH' | 'NO_TRADE' | 'MANUAL_CHECK_REQUIRED';

export type AiDecision = 'RUN_GRID' | 'WAIT' | 'NO_EXECUTION' | 'MANUAL_CHECK';

export interface AiSetupSnapshot {
  entryLow: number;
  entryHigh: number;
  gridLow: number;
  gridHigh: number;
  gridCount: number;
  stopLoss: number;
  takeProfit: number;
  investment: number;
  trailingStopPercent: number;
  trailingUp: boolean;
}

export interface AiAnalysisResult {
  state: AiSignalState;
  symbol: string;
  targetBotPair: string;
  decision: AiDecision;
  setup: AiSetupSnapshot;
  risk: GridRisk;
  confidence: number;
  reasons: string[];
  warnings: string[];
  waitingFor: string[];
}

export interface MarketSignal {
  symbol: string;
  pairAnalyzed: string;
  targetBotPair: string;
  quoteAsset: 'USDT' | 'USDC';
  usdcAvailable: boolean;
  state: SignalState;
  currentPrice: number;
  price24hChangePercent: number;
  turnover24h: number;
  score: number;
  reasons: string[];
  rejectionReasons: string[];
  generatedAt: string;
  previousState?: SignalState;
  stateChanged: boolean;
  market?: MarketStructureAnalysis;
  setup?: GridBotSetup;
  pairValidation?: PairValidation;
  aiAnalysis?: AiAnalysisResult;
  finalState?: AiSignalState;
}

export interface SignalizerScanResult {
  generatedAt: string;
  isRunning: boolean;
  skipped: boolean;
  count: number;
  stateChangedCount: number;
  signals: MarketSignal[];
}
