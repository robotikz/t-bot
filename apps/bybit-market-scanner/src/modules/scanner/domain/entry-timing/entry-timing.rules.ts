import { clamp, round } from '../../../../shared/utils/math.js';
import type { Candle } from '../../../market/market.types.js';
import type {
  BreakoutSignal,
  EntryTimingContext,
  EvaluationFlags,
  PullbackSignal
} from './entry-timing.types.js';

function safePercentDiff(reference: number, value: number): number {
  if (reference <= 0) return 0;
  return Math.abs(((value - reference) / reference) * 100);
}

function getLastCandles(candles: Candle[], size: number): Candle[] {
  if (candles.length <= size) return candles;
  return candles.slice(candles.length - size);
}

export function detectPullbackSignal(candles: Candle[], support: number): PullbackSignal {
  const recent = getLastCandles(candles.filter((candle) => candle.isClosed), 18);
  if (recent.length < 6) {
    return {
      nearSupport: false,
      higherLow: false,
      stabilized: false,
      isStabilizing: false
    };
  }

  const lows = recent.map((candle) => candle.low);
  const closes = recent.map((candle) => candle.close);

  const previousWindow = lows.slice(0, Math.max(0, lows.length - 4));
  const recentWindow = lows.slice(Math.max(0, lows.length - 4));

  const previousLow = Math.min(...previousWindow);
  const recentLow = Math.min(...recentWindow);

  const higherLow = previousLow > 0 && recentLow >= previousLow * 0.997;

  const close1 = closes[closes.length - 1] ?? 0;
  const close2 = closes[closes.length - 2] ?? 0;
  const close3 = closes[closes.length - 3] ?? 0;
  const stabilized = close1 >= close2 * 0.998 && close2 >= close3 * 0.995;

  const nearSupport = support > 0 && safePercentDiff(support, close1) <= 1.5;

  return {
    nearSupport,
    higherLow,
    stabilized,
    isStabilizing: nearSupport && higherLow && stabilized
  };
}

export function detectBreakoutRetestSignal(candles: Candle[], resistance: number): BreakoutSignal {
  const recent = getLastCandles(candles.filter((candle) => candle.isClosed), 20);
  if (recent.length < 6 || resistance <= 0) {
    return {
      breakoutDetected: false,
      retestSeen: false,
      failedRetest: false,
      breakoutConfirmed: false
    };
  }

  const breakoutThreshold = resistance * 1.001;
  const holdThreshold = resistance * 0.999;
  const failThreshold = resistance * 0.997;

  let breakoutIndex = -1;

  for (let i = 1; i < recent.length; i += 1) {
    const current = recent[i];
    const prev = recent[i - 1];
    if (!current || !prev) continue;

    const crossedUp = prev.close <= breakoutThreshold && current.close > breakoutThreshold;
    if (crossedUp) {
      breakoutIndex = i;
      break;
    }
  }

  if (breakoutIndex < 0) {
    return {
      breakoutDetected: false,
      retestSeen: false,
      failedRetest: false,
      breakoutConfirmed: false
    };
  }

  let retestSeen = false;
  let failedRetest = false;

  for (let i = breakoutIndex + 1; i < recent.length; i += 1) {
    const candle = recent[i];
    if (!candle) continue;

    if (candle.close < failThreshold) {
      failedRetest = true;
    }

    const touchedRetestZone = candle.low <= resistance * 1.003;
    const heldAboveLevel = candle.close >= holdThreshold;
    if (touchedRetestZone && heldAboveLevel) {
      retestSeen = true;
    }
  }

  return {
    breakoutDetected: true,
    retestSeen,
    failedRetest,
    breakoutConfirmed: retestSeen && !failedRetest
  };
}

export function calculateEntryScore(flags: EvaluationFlags, volatilityInBounds: boolean): number {
  let score = 0;

  if (flags.isNearSupport) score += 25;
  if (flags.trend1hUp) score += 20;
  if (flags.trend15mUp) score += 15;
  if (flags.isInLowerMiddleRange) score += 15;
  if (flags.hasGoodResistanceDistance) score += 10;
  if (flags.pullbackReadySetup) score += 10;
  if (volatilityInBounds) score += 5;

  if (flags.isNearUpperRange) score -= 20;
  if (flags.isNearResistance) score -= 20;
  if (flags.pumpNearHigh) score -= 20;
  if (flags.extremePumpNearHigh) score -= 30;
  if (flags.trend1hDown) score -= 30;

  return clamp(score, 0, 100);
}

export function buildRecommendedEntryZone(
  support: number,
  resistance: number,
  volatilityPercent: number
): EntryTimingContext['recommendedEntryZone'] {
  const volatilityRatio = clamp(volatilityPercent / 100, 0.001, 0.02);
  const supportMin = support * (1 - volatilityRatio * 0.8);
  const supportMax = support * (1 + volatilityRatio * 1.2);

  const breakoutMin = resistance * (1 - volatilityRatio * 0.6);
  const breakoutMax = resistance * (1 + volatilityRatio * 0.6);

  return {
    supportBasedEntry: {
      min: round(Math.min(supportMin, supportMax), 6),
      max: round(Math.max(supportMin, supportMax), 6)
    },
    breakoutRetestEntry: {
      min: round(Math.min(breakoutMin, breakoutMax), 6),
      max: round(Math.max(breakoutMin, breakoutMax), 6)
    }
  };
}

export function buildRecommendedGridPlan(input: {
  support15m: number;
  support1h: number;
  resistance15m: number;
  resistance1h: number;
  volatilityPercent: number;
}): {
  recommendedGridRange: { lower: number; upper: number };
  recommendedStopLoss: number;
  recommendedTakeProfit: number;
  recommendedGrids: number;
} {
  const volatilityRatio = clamp(input.volatilityPercent / 100, 0.003, 0.03);

  const supportFloor = Math.min(input.support15m, input.support1h);
  const resistanceCeiling = Math.max(input.resistance15m, input.resistance1h);

  const lower = round(supportFloor * (1 - volatilityRatio * 0.7), 6);
  const upper = round(resistanceCeiling * (1 + volatilityRatio * 0.7), 6);

  const safeLower = Math.min(lower, upper * 0.995);
  const safeUpper = Math.max(upper, safeLower * 1.005);

  const stopLoss = round(safeLower * (1 - volatilityRatio), 6);
  const takeProfit = round(safeUpper * (1 + volatilityRatio), 6);

  const spanPercent = safeLower > 0 ? ((safeUpper - safeLower) / safeLower) * 100 : 0;
  const targetCellPercent = Math.max(0.4, input.volatilityPercent * 0.8);
  const recommendedGrids = clamp(Math.round(spanPercent / targetCellPercent), 8, 40);

  return {
    recommendedGridRange: {
      lower: round(safeLower, 6),
      upper: round(safeUpper, 6)
    },
    recommendedStopLoss: stopLoss,
    recommendedTakeProfit: takeProfit,
    recommendedGrids: Math.round(recommendedGrids)
  };
}
