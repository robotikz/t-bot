import { round } from '../../../shared/utils/math.js';
import type { MarketAnalysis } from '../../analysis/analysis.types.js';
import {
  detectBreakoutRetestSignal,
  detectPullbackSignal
} from '../../scanner/domain/entry-timing/entry-timing.rules.js';
import type {
  GridBotSetup,
  MarketStructureAnalysis,
  SignalState,
  TimeframeAnalysis
} from '../signalizer.types.js';
import { calculateRisk } from './risk-calculator.js';
import type { GridSetupEvaluation, GridSetupInput } from './grid-setup.types.js';

function mapTrend(direction: MarketAnalysis['trendDirection']): TimeframeAnalysis['trend'] {
  if (direction === 'UP') return 'BULLISH';
  if (direction === 'DOWN') return 'BEARISH';
  return 'SIDEWAYS';
}

function resolveMomentum(
  trendDirection: MarketAnalysis['trendDirection'],
  trendStrength: number,
  positionInRangePercent: number
): TimeframeAnalysis['momentum'] {
  if (trendDirection === 'UP' && trendStrength >= 2.5) return 'STRONG_BULLISH';
  if (trendDirection === 'UP') return 'BULLISH';
  if (trendDirection === 'DOWN' && (trendStrength >= 2.5 || positionInRangePercent <= 20)) {
    return 'STRONG_BEARISH';
  }
  if (trendDirection === 'DOWN') return 'BEARISH';
  return 'NEUTRAL';
}

function toTimeframeAnalysis(analysis: MarketAnalysis): TimeframeAnalysis {
  const momentum = resolveMomentum(
    analysis.trendDirection,
    analysis.trendStrength,
    analysis.positionInRangePercent
  );

  return {
    trend: mapTrend(analysis.trendDirection),
    support: analysis.support,
    resistance: analysis.resistance,
    rangeLow: analysis.rangeLow,
    rangeHigh: analysis.rangeHigh,
    rangePercent: analysis.rangePercent,
    positionInRange: analysis.positionInRangePercent,
    volatility: analysis.volatilityPercent,
    trendStrength: analysis.trendStrength,
    ...(momentum ? { momentum } : {})
  };
}

function clampInvestment(defaultInvestment: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, defaultInvestment));
}

function calculateGridCount(rangePercent: number, input: GridSetupInput): number {
  if (rangePercent <= input.config.gridRangeFor6GridsMaxPercent) return 6;
  if (rangePercent <= input.config.gridRangeFor8GridsMaxPercent) return 8;
  if (rangePercent <= input.config.gridRangeFor10GridsMaxPercent) return 10;
  return Math.min(10, input.config.gridMaxAutoGrids);
}

function calculateConfidence(params: {
  structure4hTradable: boolean;
  range1hValid: boolean;
  supportConfirmed: boolean;
  higherLow: boolean;
  volatilityValid: boolean;
  liquidityValid: boolean;
  usdcAvailable: boolean;
  distanceToResistancePercent: number;
  distanceToInvalidationPercent: number;
}): number {
  let score = 0;

  if (params.structure4hTradable) score += 18;
  if (params.range1hValid) score += 18;
  if (params.supportConfirmed) score += 15;
  if (params.higherLow) score += 10;
  if (params.volatilityValid) score += 12;
  if (params.liquidityValid) score += 10;
  if (params.usdcAvailable) score += 10;
  if (params.distanceToResistancePercent >= 2) score += 4;
  if (params.distanceToInvalidationPercent >= 1.5) score += 3;

  return Math.max(0, Math.min(100, score));
}

function isRangeValid(input: GridSetupInput, gridLow: number, gridHigh: number): boolean {
  if (gridLow <= 0 || gridHigh <= 0 || gridHigh <= gridLow) return false;

  const rangePercent = ((gridHigh - gridLow) / gridLow) * 100;
  return rangePercent >= input.config.minRangePercent && rangePercent <= input.config.maxRangePercent;
}

function buildSetup(
  input: GridSetupInput,
  market: MarketStructureAnalysis,
  reasons: string[],
  rejectionReasons: string[]
): { setup?: GridBotSetup; state: SignalState } {
  const analysis1h = input.analysis1h;
  const analysis15m = input.analysis15m;

  if (!analysis1h || !analysis15m) {
    rejectionReasons.push('INSUFFICIENT_TIMEFRAME_ANALYSIS');
    return { state: 'WATCH' };
  }

  if (analysis1h.trendDirection === 'DOWN') {
    rejectionReasons.push('BEARISH_1H_TREND');
    return { state: 'NO_TRADE' };
  }

  const volatilityValid =
    analysis1h.volatilityPercent >= input.config.minAvgRangePercent &&
    analysis1h.volatilityPercent <= input.config.maxAvgRangePercent;

  if (!volatilityValid) {
    rejectionReasons.push('VOLATILITY_OUT_OF_BOUNDS');
    return { state: 'NO_TRADE' };
  }

  const pullbackSignal = detectPullbackSignal(input.candles15m, analysis15m.support);
  const breakoutSignal = detectBreakoutRetestSignal(input.candles15m, analysis15m.resistance);

  const support = Math.min(analysis1h.support, input.analysis4h.support);
  const resistance = Math.max(analysis1h.resistance, input.analysis4h.resistance);

  if (support <= 0 || resistance <= 0 || resistance <= support) {
    rejectionReasons.push('STRUCTURE_UNAVAILABLE');
    return { state: 'NO_TRADE' };
  }

  const gridLow = round(support * (1 + input.config.gridSupportBufferPercent / 100), 6);
  const gridHigh = round(resistance * (1 - input.config.gridResistanceBufferPercent / 100), 6);

  if (!isRangeValid(input, gridLow, gridHigh)) {
    rejectionReasons.push('RANGE_OUT_OF_BOUNDS');
    return { state: 'NO_TRADE' };
  }

  const currentPrice = input.market.currentPrice;
  const position1h = analysis1h.positionInRangePercent;
  const nearResistance =
    analysis1h.distanceToResistancePercent < input.config.gridMinDistanceToResistancePercent ||
    position1h >= input.config.gridEntryMaxPositionInRangePercent;

  if (nearResistance) {
    reasons.push('Price is too close to resistance for a safe Grid entry.');
    return { state: 'SETUP_FORMING' };
  }

  const supportConfirmed = pullbackSignal.isStabilizing || breakoutSignal.breakoutConfirmed;
  if (!supportConfirmed) {
    reasons.push('Waiting for 15M support confirmation before entry.');
    return { state: 'SETUP_FORMING' };
  }

  const entryZoneBuffer = input.config.gridEntryZoneBufferPercent / 100;
  const provisionalEntryLow = round(Math.max(gridLow, currentPrice * (1 - entryZoneBuffer)), 6);
  const provisionalEntryHigh = round(Math.min(gridHigh, currentPrice * (1 + entryZoneBuffer)), 6);

  const entryLow = Math.min(provisionalEntryLow, provisionalEntryHigh);
  const entryHigh = Math.max(provisionalEntryLow, provisionalEntryHigh);

  if (entryLow <= gridLow || entryHigh >= gridHigh) {
    reasons.push('Entry band is not yet safely positioned inside the Grid range.');
    return { state: 'SETUP_FORMING' };
  }

  const structuralInvalidation = Math.min(analysis1h.support, input.analysis4h.support);
  const stopLoss = round(
    structuralInvalidation * (1 - input.config.gridStopLossBufferPercent / 100),
    6
  );
  if (stopLoss >= gridLow) {
    rejectionReasons.push('STOP_LOSS_INVALID');
    return { state: 'NO_TRADE' };
  }

  const takeProfit = round(
    Math.min(gridHigh, resistance * (1 - input.config.gridTakeProfitBufferPercent / 100)),
    6
  );

  const distanceToResistancePercent = round(((takeProfit - currentPrice) / currentPrice) * 100, 4);
  const distanceToInvalidationPercent = round(((entryLow - stopLoss) / entryLow) * 100, 4);

  if (distanceToResistancePercent < input.config.gridMinDistanceToResistancePercent) {
    reasons.push('Upside to resistance is too small for READY execution.');
    return { state: 'SETUP_FORMING' };
  }

  if (distanceToInvalidationPercent < input.config.gridMinDistanceToInvalidationPercent) {
    reasons.push('Invalidation distance is too tight.');
    return { state: 'SETUP_FORMING' };
  }

  const rangePercent = ((gridHigh - gridLow) / gridLow) * 100;
  const gridCount = calculateGridCount(rangePercent, input);

  const confidence = calculateConfidence({
    structure4hTradable: input.analysis4h.trendDirection !== 'DOWN',
    range1hValid: rangePercent >= input.config.minRangePercent && rangePercent <= input.config.maxRangePercent,
    supportConfirmed,
    higherLow: pullbackSignal.higherLow,
    volatilityValid,
    liquidityValid: input.market.turnover24h >= input.config.minTurnover24hUsdt,
    usdcAvailable: input.usdcAvailable,
    distanceToResistancePercent,
    distanceToInvalidationPercent
  });

  const riskInfo = calculateRisk({
    distanceToInvalidationPercent,
    distanceToResistancePercent,
    volatilityPercent: analysis1h.volatilityPercent,
    rangePercent,
    trendAligned: input.analysis4h.trendDirection !== 'DOWN',
    entryConfirmed: supportConfirmed,
    turnover24h: input.market.turnover24h
  });

  const baseInvestment = clampInvestment(
    input.config.gridDefaultInvestment,
    input.config.gridMinInvestment,
    input.config.gridMaxInvestment
  );

  const investment =
    riskInfo.risk === 'HIGH'
      ? input.config.gridMinInvestment
      : clampInvestment(baseInvestment, input.config.gridMinInvestment, input.config.gridMaxInvestment);

  const setup: GridBotSetup = {
    entryLow,
    entryHigh,
    gridLow,
    gridHigh,
    gridCount,
    stopLoss,
    takeProfit,
    trailingStopPercent: input.config.gridTrailingStopPercent,
    trailingUp: input.config.gridTrailingUp,
    investment,
    risk: riskInfo.risk,
    confidence,
    distanceToResistancePercent,
    distanceToInvalidationPercent
  };

  const structurallyValid =
    setup.gridLow < setup.entryLow &&
    setup.entryLow <= setup.entryHigh &&
    setup.entryHigh < setup.gridHigh &&
    setup.stopLoss < setup.gridLow &&
    setup.takeProfit <= setup.gridHigh;

  if (!structurallyValid) {
    rejectionReasons.push('SETUP_VALIDATION_FAILED');
    return { state: 'NO_TRADE' };
  }

  return { setup, state: 'READY' };
}

export class GridSetupGenerator {
  evaluate(input: GridSetupInput): GridSetupEvaluation {
    const analysis1h = input.analysis1h;
    const analysis15m = input.analysis15m;

    const reasons: string[] = [];
    const rejectionReasons: string[] = [];

    const pairValidation = {
      status: input.usdcAvailable ? 'USDC_READY' : 'MANUAL_CHECK_REQUIRED'
    } as const;

    const market: MarketStructureAnalysis = {
      timeframe4h: toTimeframeAnalysis(input.analysis4h),
      timeframe1h: analysis1h
        ? toTimeframeAnalysis(analysis1h)
        : {
            trend: 'SIDEWAYS'
          },
      timeframe15m: analysis15m
        ? toTimeframeAnalysis(analysis15m)
        : {
            trend: 'SIDEWAYS'
          }
    };

    if (analysis15m) {
      const pullbackSignal = detectPullbackSignal(input.candles15m, analysis15m.support);
      const breakoutSignal = detectBreakoutRetestSignal(input.candles15m, analysis15m.resistance);
      market.timeframe15m = {
        ...market.timeframe15m,
        higherLow: pullbackSignal.higherLow,
        supportHeld: pullbackSignal.nearSupport,
        stabilizing: pullbackSignal.isStabilizing,
        breakout: breakoutSignal.breakoutDetected,
        retest: breakoutSignal.retestSeen,
        lowerHigh: !pullbackSignal.higherLow && analysis15m.trendDirection === 'DOWN'
      };
    }

    const built = buildSetup(input, market, reasons, rejectionReasons);

    let nextState = built.state;

    if (nextState === 'READY' && !input.usdcAvailable) {
      reasons.push('USDC pair confirmation is required before automatic execution.');
      nextState = 'SETUP_FORMING';
    }

    if (input.state === 'NO_TRADE' || input.state === 'WATCH') {
      nextState = input.state;
    }

    return {
      state: nextState,
      market,
      reasons,
      rejectionReasons,
      pairValidation,
      ...(built.setup ? { setup: built.setup } : {})
    };
  }
}
