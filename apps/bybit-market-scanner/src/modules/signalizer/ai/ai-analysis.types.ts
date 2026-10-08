import type {
  AiAnalysisResult,
  GridBotSetup,
  MarketSignal,
  PairValidation,
  SignalState,
  TimeframeAnalysis
} from '../signalizer.types.js';

export interface AiMarketContext {
  '4h': TimeframeAnalysis;
  '1h': TimeframeAnalysis;
  '15m': TimeframeAnalysis;
}

export interface AiAnalysisContext {
  symbol: string;
  pairAnalyzed: string;
  targetBotPair: string;
  currentPrice: number;
  price24hChangePercent: number;
  turnover24h: number;
  score: number;
  stateBeforeAi: SignalState;
  market: AiMarketContext;
  setup: GridBotSetup;
  usdcAvailable: boolean;
  pairValidation: PairValidation;
  reasons: string[];
  rejectionReasons: string[];
}

export interface AiAnalyzeRequest {
  symbol?: string;
  signal?: MarketSignal;
}

export interface SignalizerAiAnalyzer {
  analyze(context: AiAnalysisContext): Promise<unknown>;
}

export interface AiRuntimeConfig {
  enabled: boolean;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  maxCandidates: number;
}

export type { AiAnalysisResult };
