import type { AppConfig } from '../../../config/config.js';
import type { MarketAnalysis } from '../../analysis/analysis.types.js';
import type { Candle } from '../../market/market.types.js';
import type {
  GridBotSetup,
  GridRisk,
  MarketStructureAnalysis,
  PairValidation,
  SignalState
} from '../signalizer.types.js';

export interface GridSetupInput {
  config: AppConfig;
  state: SignalState;
  market: {
    symbol: string;
    currentPrice: number;
    turnover24h: number;
  };
  analysis4h: MarketAnalysis;
  analysis1h?: MarketAnalysis;
  analysis15m?: MarketAnalysis;
  candles15m: Candle[];
  usdcAvailable: boolean;
}

export interface GridSetupEvaluation {
  state: SignalState;
  setup?: GridBotSetup;
  market: MarketStructureAnalysis;
  reasons: string[];
  rejectionReasons: string[];
  pairValidation: PairValidation;
}

export interface RiskInput {
  distanceToInvalidationPercent: number;
  distanceToResistancePercent: number;
  volatilityPercent: number;
  rangePercent: number;
  trendAligned: boolean;
  entryConfirmed: boolean;
  turnover24h: number;
}

export interface RiskEvaluation {
  risk: GridRisk;
  score: number;
}
