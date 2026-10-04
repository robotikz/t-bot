import type { ScannerWeights } from '../modules/scanner/scanner.types.js';

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface AppConfig {
  port: number;
  bybitBaseUrl: string;
  analysisCandleLimit: number;
  minTurnover24hUsdc: number;
  max24hDropPercent: number;
  max1hWindowDropPercent: number;
  maxTrendStrengthPercent: number;
  minRangePercent: number;
  maxRangePercent: number;
  minAvgRangePercent: number;
  maxAvgRangePercent: number;
  srSwingWindow: number;
  srClusterPercent: number;
  srMinTouches: number;
  maxConcurrentCandleRequests: number;
  topCandidates: number;
  instrumentsCacheTtlMs: number;
  tickersCacheTtlMs: number;
  candlesCacheTtlMs: number;
  scannerWeights: ScannerWeights;
  liquidityTiers: [number, number, number, number];
}

export function loadConfig(): AppConfig {
  return {
    port: readNumber('PORT', 3000),
    bybitBaseUrl: process.env.BYBIT_BASE_URL ?? 'https://api.bybit.com',
    analysisCandleLimit: clampNumber(readNumber('ANALYSIS_CANDLE_LIMIT', 200), 100, 200),
    minTurnover24hUsdc: readNumber('MIN_TURNOVER_24H_USDC', 1_000_000),
    max24hDropPercent: readNumber('MAX_24H_DROP_PERCENT', 8),
    max1hWindowDropPercent: readNumber('MAX_1H_WINDOW_DROP_PERCENT', 10),
    maxTrendStrengthPercent: readNumber('MAX_TREND_STRENGTH_PERCENT', 5),
    minRangePercent: readNumber('MIN_RANGE_PERCENT', 3),
    maxRangePercent: readNumber('MAX_RANGE_PERCENT', 30),
    minAvgRangePercent: readNumber('MIN_AVG_RANGE_PERCENT', 0.3),
    maxAvgRangePercent: readNumber('MAX_AVG_RANGE_PERCENT', 5),
    srSwingWindow: Math.max(1, Math.floor(readNumber('SR_SWING_WINDOW', 2))),
    srClusterPercent: readNumber('SR_CLUSTER_PERCENT', 1),
    srMinTouches: Math.max(1, Math.floor(readNumber('SR_MIN_TOUCHES', 2))),
    maxConcurrentCandleRequests: Math.max(
      1,
      Math.floor(readNumber('MAX_CONCURRENT_CANDLE_REQUESTS', 5))
    ),
    topCandidates: Math.max(1, Math.floor(readNumber('TOP_CANDIDATES', 10))),
    instrumentsCacheTtlMs: Math.max(0, readNumber('INSTRUMENTS_CACHE_TTL_MS', 300_000)),
    tickersCacheTtlMs: Math.max(0, readNumber('TICKERS_CACHE_TTL_MS', 30_000)),
    candlesCacheTtlMs: Math.max(0, readNumber('CANDLES_CACHE_TTL_MS', 45_000)),
    scannerWeights: {
      liquidity: 25,
      range: 25,
      trend: 20,
      volatility: 15,
      supportResistance: 15
    },
    liquidityTiers: [
      readNumber('LIQUIDITY_TIER_1', 50_000_000),
      readNumber('LIQUIDITY_TIER_2', 10_000_000),
      readNumber('LIQUIDITY_TIER_3', 5_000_000),
      readNumber('LIQUIDITY_TIER_4', 1_000_000)
    ]
  };
}
