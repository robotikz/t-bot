import type { AppConfig } from '../../config/config.js';
import { calculateRangeMetrics } from '../analysis/range.js';
import { AnalysisService } from '../analysis/analysis.service.js';
import type { MarketService } from '../market/market.service.js';
import { ScannerService } from '../scanner/scanner.service.js';
import type { ScannerCandidate } from '../scanner/scanner.types.js';
import { HistoricalMarketService } from './historical-market.service.js';
import {
  TIMEFRAME_MS,
  type HistoricalDataset,
  type HorizonOutcome,
  type Observation,
  type ObservationRange,
  type RawCandle
} from './backtest.types.js';

const HOUR_MS = TIMEFRAME_MS['1h'];
const M15_MS = TIMEFRAME_MS['15m'];

export const DEFAULT_HORIZON_HOURS = [24, 72, 168] as const;

export interface EvaluationOptions {
  /** Hours between evaluation timestamps. Timestamps are aligned to whole hours. */
  stepHours: number;
  horizonHours: readonly number[];
  /** First evaluation timestamp; defaults to dataset start + warm-up, rounded up to the hour. */
  firstEvalMs?: number;
  /** Last evaluation timestamp (inclusive); defaults to the last whole hour before the cutoff. */
  lastEvalMs?: number;
  quoteCoin?: string;
  onProgress?: (message: string) => void;
}

export function horizonKey(hours: number): string {
  return `${hours}h`;
}

export function ceilToHour(ms: number): number {
  return Math.ceil(ms / HOUR_MS) * HOUR_MS;
}

export function floorToHour(ms: number): number {
  return Math.floor(ms / HOUR_MS) * HOUR_MS;
}

/** Ascending, hour-aligned evaluation timestamps in [firstMs, lastMs]. */
export function buildEvaluationTimestamps(firstMs: number, lastMs: number, stepHours: number): number[] {
  if (!Number.isInteger(stepHours) || stepHours < 1) throw new Error('stepHours must be a positive integer');
  const out: number[] = [];
  for (let t = ceilToHour(firstMs); t <= lastMs; t += stepHours * HOUR_MS) out.push(t);
  assertChronological(out);
  return out;
}

export function assertChronological(timestamps: readonly number[]): void {
  for (let i = 1; i < timestamps.length; i += 1) {
    const prev = timestamps[i - 1];
    const cur = timestamps[i];
    if (prev === undefined || cur === undefined || cur <= prev) {
      throw new Error(`Evaluation timestamps are not strictly ascending at index ${i}`);
    }
  }
}

/**
 * Classifies subsequent 15m price movement against a fixed range over [asOfMs, asOfMs + horizon).
 *
 *  - Only candles that opened inside the window are used (the dataset contains closed candles only).
 *  - A breach is low < rangeLow (below) or high > rangeHigh (above), strictly.
 *  - The first breaching candle decides the outcome. If it pierces both bounds the outcome is the
 *    conservative BROKE_BELOW and `ambiguousSameCandle` is set.
 *  - An observed breach is definitive even if later candles are missing.
 *  - INSIDE requires the complete window (every expected 15m candle present). Otherwise the result
 *    is INSUFFICIENT_FUTURE and is never counted as a surviving range.
 *  - Excursions are the maxima over the whole observed window, even after the first break.
 */
export function classifyHorizon(
  future15m: readonly RawCandle[],
  asOfMs: number,
  horizonMs: number,
  rangeLow: number,
  rangeHigh: number
): HorizonOutcome {
  const endMs = asOfMs + horizonMs;
  const expectedCandles = horizonMs / M15_MS;
  let observed = 0;
  let minLow = Number.POSITIVE_INFINITY;
  let maxHigh = Number.NEGATIVE_INFINITY;
  let firstSide: 'BELOW' | 'ABOVE' | null = null;
  let firstBreakAfterMs: number | null = null;
  let ambiguous = false;

  for (let index = lowerBound15m(future15m, asOfMs); index < future15m.length; index += 1) {
    const candle = future15m[index];
    if (!candle) break;
    if (candle.timestamp >= endMs) break;
    observed += 1;
    if (candle.low < minLow) minLow = candle.low;
    if (candle.high > maxHigh) maxHigh = candle.high;
    if (firstSide === null) {
      const below = candle.low < rangeLow;
      const above = candle.high > rangeHigh;
      if (below || above) {
        firstSide = below ? 'BELOW' : 'ABOVE';
        ambiguous = below && above;
        firstBreakAfterMs = candle.timestamp - asOfMs;
      }
    }
  }

  const maxDownsidePercent =
    observed > 0 && minLow < rangeLow && rangeLow > 0 ? ((rangeLow - minLow) / rangeLow) * 100 : 0;
  const maxUpsidePercent =
    observed > 0 && maxHigh > rangeHigh && rangeHigh > 0 ? ((maxHigh - rangeHigh) / rangeHigh) * 100 : 0;

  const outcome: HorizonOutcome['outcome'] =
    firstSide === 'BELOW'
      ? 'BROKE_BELOW'
      : firstSide === 'ABOVE'
        ? 'BROKE_ABOVE'
        : observed === expectedCandles
          ? 'INSIDE'
          : 'INSUFFICIENT_FUTURE';

  return {
    outcome,
    observedCandles: observed,
    expectedCandles,
    missingCandles: expectedCandles - observed,
    maxDownsidePercent: Number(maxDownsidePercent.toFixed(4)),
    maxUpsidePercent: Number(maxUpsidePercent.toFixed(4)),
    firstBreakAfterMs,
    ambiguousSameCandle: ambiguous
  };
}

function lowerBound15m(candles: readonly RawCandle[], asOfMs: number): number {
  let lo = 0;
  let hi = candles.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const c = candles[mid];
    if (c && c.timestamp < asOfMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function toRange(low: number, high: number): ObservationRange {
  return { low, high, widthPercent: low > 0 ? Number((((high - low) / low) * 100).toFixed(4)) : 0 };
}

export class HistoricalEvaluator {
  private readonly market: HistoricalMarketService;
  private readonly scanner: ScannerService;

  /**
   * `config` is the unmodified production config. ScannerService/AnalysisService are the
   * production classes, driven by the replay market service instead of live Bybit calls.
   */
  constructor(
    private readonly dataset: HistoricalDataset,
    private readonly config: AppConfig
  ) {
    this.market = new HistoricalMarketService(dataset);
    const asMarket = this.market as unknown as MarketService;
    this.scanner = new ScannerService(asMarket, new AnalysisService(asMarket, config), config);
  }

  defaultFirstEvalMs(): number {
    // Warm-up so that the scanner's 200 hourly candles exist; earlier decisions would be
    // dominated by INSUFFICIENT_CANDLES rather than market behaviour.
    return ceilToHour(this.dataset.startMs + this.config.analysisCandleLimit * HOUR_MS);
  }

  defaultLastEvalMs(): number {
    return floorToHour(this.dataset.cutoffMs) - HOUR_MS;
  }

  async evaluate(options: EvaluationOptions): Promise<Observation[]> {
    const first = options.firstEvalMs ?? this.defaultFirstEvalMs();
    const last = options.lastEvalMs ?? this.defaultLastEvalMs();
    const timestamps = buildEvaluationTimestamps(first, last, options.stepHours);
    const observations: Observation[] = [];

    for (let i = 0; i < timestamps.length; i += 1) {
      const asOfMs = timestamps[i] as number;
      observations.push(...(await this.evaluateAt(asOfMs, options)));
      if ((i + 1) % 25 === 0) options.onProgress?.(`evaluated ${i + 1}/${timestamps.length} timestamps`);
    }
    return observations;
  }

  async evaluateAt(asOfMs: number, options: Pick<EvaluationOptions, 'horizonHours' | 'quoteCoin'>): Promise<Observation[]> {
    this.market.setAsOf(asOfMs);
    const quoteCoin = options.quoteCoin ?? this.dataset.quoteCoin;

    const result = await this.scanner.scan({ quoteCoin, limit: Number.MAX_SAFE_INTEGER });
    const candidates = new Map(result.candidates.map((c) => [c.symbol, c]));
    const unresolved = new Map((result.unresolvedSymbols ?? []).map((u) => [u.symbol, u]));
    const symbols = [...this.dataset.instruments].map((i) => i.symbol).sort();
    const out: Observation[] = [];

    for (const symbol of symbols) {
      out.push(this.buildObservation(symbol, asOfMs, options.horizonHours, candidates, unresolved));
    }
    return out;
  }

  private buildObservation(
    symbol: string,
    asOfMs: number,
    horizonHours: readonly number[],
    candidates: Map<string, ScannerCandidate>,
    unresolved: Map<string, { reasonCode: string; detail?: string }>
  ): Observation {
    const base: Observation = {
      symbol,
      asOfMs,
      asOf: new Date(asOfMs).toISOString(),
      kind: 'EXCLUDED_NO_TICKER',
      exclusionReason: null,
      status: null,
      score: null,
      rejectionReasons: [],
      price: null,
      turnover24h: null,
      change24hPercent: null,
      range: null,
      volatility1hPercent: null,
      volatility15mPercent: null,
      trend1h: null,
      trend15m: null,
      trendStrength1h: null,
      support1h: null,
      resistance1h: null,
      support15m: null,
      resistance15m: null,
      entryTiming: null,
      entryScore: null,
      recommendedGridRange: null,
      horizons: null,
      gridRangeHorizons: null,
      baselineRange: null,
      baselineHorizons: null,
      missing1hInWindow: null,
      missing15mInWindow: null
    };

    const reason = this.market.tickerUnavailableReason(symbol);
    if (reason) return { ...base, exclusionReason: reason };

    return this.fill(base, symbol, asOfMs, horizonHours, candidates.get(symbol), unresolved.get(symbol));
  }

  private fill(
    base: Observation,
    symbol: string,
    asOfMs: number,
    horizonHours: readonly number[],
    candidate: ScannerCandidate | undefined,
    unresolvedEntry: { reasonCode: string; detail?: string } | undefined
  ): Observation {
    const futureSlice = this.dataset.series.get(symbol)?.['15m'] ?? [];
    const horizonsFor = (low: number, high: number): Record<string, HorizonOutcome> => {
      const r: Record<string, HorizonOutcome> = {};
      for (const h of horizonHours) r[horizonKey(h)] = classifyHorizon(futureSlice, asOfMs, h * HOUR_MS, low, high);
      return r;
    };

    const obs: Observation = {
      ...base,
      missing1hInWindow: this.market.missingInWindow(symbol, '1h', this.config.analysisCandleLimit),
      missing15mInWindow: this.market.missingInWindow(symbol, '15m', this.config.analysisCandleLimit)
    };

    // Baseline: the scanner's own range function over the same closed hourly window the scanner
    // sees, applied to every symbol that has a ticker, with no candidate filtering at all.
    const closedHourly = this.market
      .closedCandles(symbol, '1h', this.config.analysisCandleLimit)
      .map((c) => ({ ...c, isClosed: true }));
    const price = this.market.lastClosedPrice(symbol);
    if (price !== null && closedHourly.length >= 100) {
      const m = calculateRangeMetrics(closedHourly, price);
      obs.baselineRange = toRange(m.rangeLow, m.rangeHigh);
      obs.baselineHorizons = horizonsFor(m.rangeLow, m.rangeHigh);
    }

    if (unresolvedEntry && unresolvedEntry.reasonCode === 'INVALID_MARKET_DATA') {
      return { ...obs, kind: 'UNRESOLVED_INVALID_DATA', exclusionReason: unresolvedEntry.detail ?? 'INVALID_MARKET_DATA' };
    }

    if (!candidate) {
      return { ...obs, kind: 'PREFILTERED_LOW_TURNOVER', exclusionReason: 'BELOW_MIN_TURNOVER' };
    }

    const a1h = candidate.analysis1h;
    const a15 = candidate.analysis15m;
    const range = a1h ? toRange(a1h.rangeLow, a1h.rangeHigh) : null;
    const grid = candidate.recommendedGridRange ?? null;

    return {
      ...obs,
      kind: 'SCANNED',
      status: candidate.status,
      score: candidate.score,
      rejectionReasons: [...candidate.rejectionReasons].sort(),
      price: candidate.market.lastPrice,
      turnover24h: candidate.market.turnover24h,
      change24hPercent: Number(candidate.market.change24hPercent.toFixed(4)),
      range,
      volatility1hPercent: a1h?.volatilityPercent ?? null,
      volatility15mPercent: a15?.volatilityPercent ?? null,
      trend1h: a1h?.trendDirection ?? null,
      trend15m: a15?.trendDirection ?? null,
      trendStrength1h: a1h?.trendStrength ?? null,
      support1h: a1h?.support ?? null,
      resistance1h: a1h?.resistance ?? null,
      support15m: a15?.support ?? null,
      resistance15m: a15?.resistance ?? null,
      entryTiming: candidate.entryTiming,
      entryScore: candidate.entryScore,
      recommendedGridRange: grid ? { lower: grid.lower, upper: grid.upper } : null,
      horizons: range ? horizonsFor(range.low, range.high) : null,
      gridRangeHorizons: grid ? horizonsFor(grid.lower, grid.upper) : null
    };
  }
}
