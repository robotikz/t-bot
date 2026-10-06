import type { AppConfig } from '../../../../config/config.js';
import type { EntryTimingState } from '@trading-platform/shared';
import {
  buildRecommendedEntryZone,
  buildRecommendedGridPlan,
  calculateEntryScore,
  detectBreakoutRetestSignal,
  detectPullbackSignal
} from './entry-timing.rules.js';
import type { EntryTimingInput, EntryTimingOutput, EvaluationFlags } from './entry-timing.types.js';

function uniqueReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons));
}

function resolveEntryTimingByScore(score: number): EntryTimingState {
  if (score >= 75) return 'READY';
  if (score >= 60) return 'WAIT_CONFIRMATION';
  if (score >= 40) return 'WAIT_PULLBACK';
  return 'NO_ENTRY';
}

export class EntryTimingService {
  constructor(private readonly config: AppConfig) {}

  evaluate(input: EntryTimingInput): EntryTimingOutput {
    const { analysis1h, analysis15m, candles15m } = input;

    const positionInRangePercent = analysis15m.positionInRangePercent;
    const distanceToSupportPercent = analysis15m.distanceToSupportPercent;
    const distanceToResistancePercent = analysis15m.distanceToResistancePercent;
    const change24hPercent = analysis15m.change24hPercent;

    const volatilityInBounds =
      analysis15m.volatilityPercent >= this.config.minAvgRangePercent &&
      analysis15m.volatilityPercent <= this.config.maxAvgRangePercent;

    const pullbackSignal = detectPullbackSignal(candles15m, analysis15m.support);
    const breakoutSignal = detectBreakoutRetestSignal(candles15m, analysis15m.resistance);

    const flags: EvaluationFlags = {
      isNearUpperRange: positionInRangePercent >= 85,
      isVeryHighRangePosition: positionInRangePercent >= 90,
      isLowRangePosition: positionInRangePercent <= 25,
      isInLowerMiddleRange: positionInRangePercent > 25 && positionInRangePercent < 75,
      isNearSupport: distanceToSupportPercent <= 2.5,
      isNearResistance: distanceToResistancePercent < 1.5,
      hasGoodResistanceDistance: distanceToResistancePercent >= 2.5,
      pumpNearHigh: change24hPercent >= 8 && positionInRangePercent >= 80,
      extremePumpNearHigh: change24hPercent >= 12 && positionInRangePercent >= 85,
      trend1hUp: analysis1h.trendDirection === 'UP',
      trend1hDown: analysis1h.trendDirection === 'DOWN',
      trend15mUp: analysis15m.trendDirection === 'UP',
      trend15mSideways: analysis15m.trendDirection === 'SIDEWAYS',
      bullishTrendAlignment:
        analysis1h.trendDirection === 'UP' &&
        (analysis15m.trendDirection === 'UP' || analysis15m.trendDirection === 'SIDEWAYS'),
      pullbackReadySetup:
        analysis1h.trendDirection === 'UP' &&
        (analysis15m.trendDirection === 'UP' || analysis15m.trendDirection === 'SIDEWAYS') &&
        pullbackSignal.isStabilizing &&
        positionInRangePercent <= 60
    };

    const score = calculateEntryScore(flags, volatilityInBounds);

    const reasons: string[] = [];

    if (flags.isNearUpperRange) {
      reasons.push('Price is too close to the upper part of the range.');
    }

    if (flags.isNearResistance) {
      reasons.push('Price is too close to resistance.');
    }

    if (flags.pumpNearHigh) {
      reasons.push('Strong 24h pump with price near range high.');
      reasons.push('Wait for pullback toward support.');
    }

    if (flags.extremePumpNearHigh) {
      reasons.push('Extended move. Do not chase.');
    }

    if (analysis1h.trendDirection === 'UP' && analysis15m.trendDirection === 'DOWN') {
      reasons.push('1H trend is bullish but 15M is still correcting.');
    }

    if (flags.trend1hDown) {
      reasons.push('1H trend is bearish.');
    }

    if (!volatilityInBounds) {
      reasons.push('Current volatility is outside the preferred entry range.');
    }

    if (pullbackSignal.isStabilizing) {
      reasons.push('Pullback reached support and price is stabilizing.');
    }

    if (breakoutSignal.breakoutDetected && !breakoutSignal.retestSeen) {
      reasons.push('Resistance breakout detected. Waiting for retest.');
    }

    if (breakoutSignal.breakoutConfirmed) {
      reasons.push('Breakout confirmed and resistance successfully retested.');
    }

    if (flags.isLowRangePosition && !pullbackSignal.isStabilizing) {
      reasons.push('Price is in the lower range, but support still needs confirmation.');
    }

    if (flags.bullishTrendAlignment && flags.isNearSupport && flags.hasGoodResistanceDistance) {
      reasons.push('Price is favorably positioned between support and resistance.');
    }

    const recommendedEntryZone = buildRecommendedEntryZone(
      analysis15m.support,
      analysis15m.resistance,
      analysis15m.volatilityPercent
    );

    let entryTiming = resolveEntryTimingByScore(score);

    if (flags.trend1hDown || flags.extremePumpNearHigh) {
      entryTiming = 'NO_ENTRY';
    } else if (breakoutSignal.breakoutDetected && !breakoutSignal.breakoutConfirmed) {
      entryTiming = 'WAIT_BREAKOUT_RETEST';
    } else if (
      flags.isVeryHighRangePosition &&
      (flags.isNearResistance || distanceToResistancePercent <= 2)
    ) {
      entryTiming = 'WAIT_PULLBACK';
    } else if (flags.isNearUpperRange || flags.isNearResistance || flags.pumpNearHigh) {
      entryTiming = 'WAIT_PULLBACK';
    } else if (!volatilityInBounds || (analysis1h.trendDirection === 'UP' && analysis15m.trendDirection === 'DOWN')) {
      entryTiming = 'WAIT_CONFIRMATION';
    } else if (flags.pullbackReadySetup || breakoutSignal.breakoutConfirmed) {
      entryTiming = 'READY';
    }

    const output: EntryTimingOutput = {
      entryTiming,
      entryScore: score,
      entryReasons: uniqueReasons(reasons),
      recommendedEntryZone
    };

    if (entryTiming === 'READY') {
      const plan = buildRecommendedGridPlan({
        support15m: analysis15m.support,
        support1h: analysis1h.support,
        resistance15m: analysis15m.resistance,
        resistance1h: analysis1h.resistance,
        volatilityPercent: analysis15m.volatilityPercent
      });

      output.recommendedGridRange = plan.recommendedGridRange;
      output.recommendedStopLoss = plan.recommendedStopLoss;
      output.recommendedTakeProfit = plan.recommendedTakeProfit;
      output.recommendedGrids = plan.recommendedGrids;
    }

    return output;
  }
}
