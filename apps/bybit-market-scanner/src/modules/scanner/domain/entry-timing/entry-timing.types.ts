import type {
  EntryTimingState,
  RecommendedEntryZone,
  RecommendedGridRange,
  TrendDirection
} from '@trading-platform/shared';
import type { Candle } from '../../../market/market.types.js';
import type { MarketAnalysis } from '../../../analysis/analysis.types.js';

export interface EntryTimingInput {
  analysis1h: MarketAnalysis;
  analysis15m: MarketAnalysis;
  candles15m: Candle[];
}

export interface EntryTimingOutput {
  entryTiming: EntryTimingState;
  entryScore: number;
  entryReasons: string[];
  recommendedEntryZone: RecommendedEntryZone;
  recommendedGridRange?: RecommendedGridRange;
  recommendedStopLoss?: number;
  recommendedTakeProfit?: number;
  recommendedGrids?: number;
}

export interface PullbackSignal {
  nearSupport: boolean;
  higherLow: boolean;
  stabilized: boolean;
  isStabilizing: boolean;
}

export interface BreakoutSignal {
  breakoutDetected: boolean;
  retestSeen: boolean;
  failedRetest: boolean;
  breakoutConfirmed: boolean;
}

export interface EntryTimingContext {
  score: number;
  positionInRangePercent: number;
  distanceToSupportPercent: number;
  distanceToResistancePercent: number;
  change24hPercent: number;
  trend1h: TrendDirection;
  trend15m: TrendDirection;
  volatilityPercent: number;
  volatilityInBounds: boolean;
  pullbackSignal: PullbackSignal;
  breakoutSignal: BreakoutSignal;
  recommendedEntryZone: RecommendedEntryZone;
}

export interface EvaluationFlags {
  isNearUpperRange: boolean;
  isVeryHighRangePosition: boolean;
  isLowRangePosition: boolean;
  isInLowerMiddleRange: boolean;
  isNearSupport: boolean;
  isNearResistance: boolean;
  hasGoodResistanceDistance: boolean;
  pumpNearHigh: boolean;
  extremePumpNearHigh: boolean;
  trend1hUp: boolean;
  trend1hDown: boolean;
  trend15mUp: boolean;
  trend15mSideways: boolean;
  bullishTrendAlignment: boolean;
  pullbackReadySetup: boolean;
}
