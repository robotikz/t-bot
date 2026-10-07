export type SignalState =
  | 'WATCH'
  | 'SETUP_FORMING'
  | 'READY'
  | 'INVALIDATED'
  | 'NO_TRADE';

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
}

export interface SignalizerScanResult {
  generatedAt: string;
  isRunning: boolean;
  skipped: boolean;
  count: number;
  stateChangedCount: number;
  signals: MarketSignal[];
}
