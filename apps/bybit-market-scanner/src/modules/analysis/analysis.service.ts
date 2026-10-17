import type { AppConfig } from '../../config/config.js';
import { clamp } from '../../shared/utils/math.js';
import type { MarketService } from '../market/market.service.js';
import type { Timeframe } from '../market/market.types.js';
import type { MarketAnalysis } from './analysis.types.js';
import { calculateRangeMetrics } from './range.js';
import { calculateSupportResistance } from './support-resistance.js';
import { analyzeTrend } from './trend.js';
import { calculateVolatilityPercent } from './volatility.js';

function hasFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function collectValidationReasons(input: {
  price: number;
  rangeHigh: number;
  rangeLow: number;
  rangePercent: number;
  positionInRangePercent: number;
  priceVsRange?: 'BELOW_RANGE' | 'WITHIN_RANGE' | 'ABOVE_RANGE';
  support: number;
  resistance: number;
  distanceToSupportPercent: number;
  distanceToResistancePercent: number;
}): string[] {
  const reasons: string[] = [];

  const marketDataValid =
    hasFiniteNumber(input.price) &&
    input.price > 0 &&
    hasFiniteNumber(input.rangeHigh) &&
    input.rangeHigh > 0 &&
    hasFiniteNumber(input.rangeLow) &&
    input.rangeLow > 0 &&
    input.rangeHigh >= input.rangeLow &&
    hasFiniteNumber(input.rangePercent) &&
    input.rangePercent >= 0 &&
    hasFiniteNumber(input.positionInRangePercent) &&
    input.positionInRangePercent >= 0 &&
    input.positionInRangePercent <= 100;

  if (!marketDataValid) {
    reasons.push('INVALID_MARKET_DATA');
  }

  const supportResistanceValid =
    hasFiniteNumber(input.support) &&
    input.support > 0 &&
    hasFiniteNumber(input.resistance) &&
    input.resistance > 0 &&
    input.resistance > input.support &&
    hasFiniteNumber(input.distanceToSupportPercent) &&
    input.distanceToSupportPercent >= 0 &&
    hasFiniteNumber(input.distanceToResistancePercent) &&
    input.distanceToResistancePercent >= 0;

  if (!supportResistanceValid) {
    reasons.push('INVALID_SUPPORT_RESISTANCE');
  }

  if (marketDataValid && input.priceVsRange) {
    if (input.priceVsRange === 'BELOW_RANGE' && !(input.price < input.rangeLow)) {
      reasons.push('INVALID_MARKET_DATA');
    }

    if (input.priceVsRange === 'ABOVE_RANGE' && !(input.price > input.rangeHigh)) {
      reasons.push('INVALID_MARKET_DATA');
    }

    if (
      input.priceVsRange === 'WITHIN_RANGE' &&
      !(input.price >= input.rangeLow && input.price <= input.rangeHigh)
    ) {
      reasons.push('INVALID_MARKET_DATA');
    }
  }

  return Array.from(new Set(reasons));
}

function getLiquidityScore(turnover24h: number, tiers: [number, number, number, number]): number {
  if (turnover24h >= tiers[0]) return 100;
  if (turnover24h >= tiers[1]) return 80;
  if (turnover24h >= tiers[2]) return 60;
  if (turnover24h >= tiers[3]) return 40;
  return 20;
}

function getBoundedScore(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 100;
  if (value < min) return clamp((value / min) * 100, 0, 100);
  return clamp((max / value) * 100, 0, 100);
}

export class AnalysisService {
  constructor(
    private readonly marketService: MarketService,
    private readonly config: AppConfig
  ) {}

  async analyzeSymbol(
    symbol: string,
    timeframe: Timeframe,
    options?: { minTurnover?: number }
  ): Promise<MarketAnalysis> {
    const [ticker, candles] = await Promise.all([
      this.marketService.getMarketTicker(symbol),
      this.marketService.getCandles(symbol, timeframe, this.config.analysisCandleLimit)
    ]);

    const closedCandles = candles.filter((item) => item.isClosed);

    const range = calculateRangeMetrics(closedCandles, ticker.lastPrice);
    const trend = analyzeTrend(closedCandles);
    const volatilityPercent = calculateVolatilityPercent(closedCandles);
    const sr = calculateSupportResistance(closedCandles, ticker.lastPrice, {
      swingWindow: this.config.srSwingWindow,
      clusterPercent: this.config.srClusterPercent,
      minTouches: this.config.srMinTouches
    });

    const rejectionReasons: string[] = collectValidationReasons({
      price: ticker.lastPrice,
      rangeHigh: range.rangeHigh,
      rangeLow: range.rangeLow,
      rangePercent: range.rangePercent,
      positionInRangePercent: range.positionInRangePercent,
      priceVsRange: range.priceVsRange,
      support: sr.support,
      resistance: sr.resistance,
      distanceToSupportPercent: sr.distanceToSupportPercent,
      distanceToResistancePercent: sr.distanceToResistancePercent
    });

    const hasValidationFailure = rejectionReasons.length > 0;

    const minTurnover = options?.minTurnover ?? this.config.minTurnover24hUsdt;
    if (ticker.turnover24h < minTurnover) {
      rejectionReasons.push('LOW_LIQUIDITY');
    }

    if (closedCandles.length < 100) {
      rejectionReasons.push('INSUFFICIENT_CANDLES');
    }

    if (
      ticker.change24hPercent <= -this.config.max24hDropPercent &&
      trend.trendDirection === 'DOWN' &&
      trend.priceChangeWindowPercent <= -this.config.max1hWindowDropPercent
    ) {
      rejectionReasons.push('STRONG_DOWNTREND');
    } else if (
      trend.trendDirection === 'DOWN' &&
      trend.trendStrength > this.config.maxTrendStrengthPercent
    ) {
      rejectionReasons.push('TREND_TOO_STRONG');
    }

    if (range.rangePercent < this.config.minRangePercent || range.rangePercent > this.config.maxRangePercent) {
      rejectionReasons.push('RANGE_OUT_OF_BOUNDS');
    }

    if (
      volatilityPercent < this.config.minAvgRangePercent ||
      volatilityPercent > this.config.maxAvgRangePercent
    ) {
      rejectionReasons.push('VOLATILITY_OUT_OF_BOUNDS');
    }

    const liquidityScore = getLiquidityScore(ticker.turnover24h, this.config.liquidityTiers);
    const rangeScore = hasValidationFailure
      ? 0
      : getBoundedScore(range.rangePercent, this.config.minRangePercent, this.config.maxRangePercent);
    const trendScore = hasValidationFailure
      ? 0
      : clamp(100 - (trend.trendStrength / this.config.maxTrendStrengthPercent) * 100, 0, 100);
    const volatilityScore = hasValidationFailure
      ? 0
      : getBoundedScore(
          volatilityPercent,
          this.config.minAvgRangePercent,
          this.config.maxAvgRangePercent
        );

    const nearestBoundary = hasValidationFailure
      ? Number.NaN
      : Math.min(sr.distanceToSupportPercent, sr.distanceToResistancePercent);
    const supportResistanceScore = hasValidationFailure ? 0 : clamp((nearestBoundary / 10) * 100, 0, 100);

    const weights = this.config.scannerWeights;
    const totalWeight =
      weights.liquidity +
      weights.range +
      weights.trend +
      weights.volatility +
      weights.supportResistance;

    const gridScore = hasValidationFailure
      ? 0
      : (liquidityScore * weights.liquidity +
          rangeScore * weights.range +
          trendScore * weights.trend +
          volatilityScore * weights.volatility +
          supportResistanceScore * weights.supportResistance) /
        totalWeight;

    return {
      symbol,
      price: ticker.lastPrice,
      change24hPercent: ticker.change24hPercent,
      volume24h: ticker.volume24h,
      turnover24h: ticker.turnover24h,
      timeframe,
      rangeHigh: range.rangeHigh,
      rangeLow: range.rangeLow,
      rangePercent: range.rangePercent,
      support: sr.support,
      resistance: sr.resistance,
      distanceToSupportPercent: sr.distanceToSupportPercent,
      distanceToResistancePercent: sr.distanceToResistancePercent,
      positionInRangePercent: range.positionInRangePercent,
      priceVsRange: range.priceVsRange,
      volatilityPercent,
      trendDirection: trend.trendDirection,
      trendStrength: trend.trendStrength,
      liquidityScore,
      gridScore,
      rejectionReasons: Array.from(new Set(rejectionReasons))
    };
  }
}
