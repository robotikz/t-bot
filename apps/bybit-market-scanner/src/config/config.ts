import type { ScannerWeights } from '../modules/scanner/scanner.types.js';

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface AppConfig {
  port: number;
  bybitBaseUrl: string;
  analysisCandleLimit: number;
  minTurnover24hUsdt: number;
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
  signalizerMaxConcurrentSetups: number;
  gridSupportBufferPercent: number;
  gridResistanceBufferPercent: number;
  gridStopLossBufferPercent: number;
  gridTakeProfitBufferPercent: number;
  gridEntryZoneBufferPercent: number;
  gridEntryMaxPositionInRangePercent: number;
  gridMinDistanceToResistancePercent: number;
  gridMinDistanceToInvalidationPercent: number;
  gridTrailingStopPercent: number;
  gridTrailingUp: boolean;
  gridDefaultInvestment: number;
  gridMinInvestment: number;
  gridMaxInvestment: number;
  gridRangeFor6GridsMaxPercent: number;
  gridRangeFor8GridsMaxPercent: number;
  gridRangeFor10GridsMaxPercent: number;
  gridMaxAutoGrids: number;
  aiEnabled: boolean;
  aiModel: string;
  aiTimeoutMs: number;
  aiMaxRetries: number;
  aiMaxCandidates: number;
  aiApiUrl: string | undefined;
  aiApiKey: string | undefined;
}

export function loadConfig(): AppConfig {
  const minTurnover24hUsdt = readNumber(
    'MIN_TURNOVER_24H_USDT',
    readNumber('MIN_TURNOVER_24H_USDC', 1_000_000)
  );

  return {
    port: readNumber('PORT', 3000),
    bybitBaseUrl:
      process.env.BYBIT_API_BASE_URL ?? process.env.BYBIT_BASE_URL ?? 'https://api.bybit.eu',
    analysisCandleLimit: clampNumber(readNumber('ANALYSIS_CANDLE_LIMIT', 200), 100, 200),
    minTurnover24hUsdt,
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
    ],
    signalizerMaxConcurrentSetups: Math.max(
      1,
      Math.floor(readNumber('SIGNALIZER_MAX_CONCURRENT_SETUPS', 5))
    ),
    gridSupportBufferPercent: readNumber('GRID_SUPPORT_BUFFER_PERCENT', 0.4),
    gridResistanceBufferPercent: readNumber('GRID_RESISTANCE_BUFFER_PERCENT', 0.4),
    gridStopLossBufferPercent: readNumber('GRID_STOP_LOSS_BUFFER_PERCENT', 1),
    gridTakeProfitBufferPercent: readNumber('GRID_TAKE_PROFIT_BUFFER_PERCENT', 0.3),
    gridEntryZoneBufferPercent: readNumber('GRID_ENTRY_ZONE_BUFFER_PERCENT', 0.6),
    gridEntryMaxPositionInRangePercent: readNumber('GRID_ENTRY_MAX_POSITION_IN_RANGE_PERCENT', 80),
    gridMinDistanceToResistancePercent: readNumber('GRID_MIN_DISTANCE_TO_RESISTANCE_PERCENT', 1.8),
    gridMinDistanceToInvalidationPercent: readNumber('GRID_MIN_DISTANCE_TO_INVALIDATION_PERCENT', 1.2),
    gridTrailingStopPercent: readNumber('GRID_TRAILING_STOP_PERCENT', 4),
    gridTrailingUp: readBoolean('GRID_TRAILING_UP', false),
    gridDefaultInvestment: readNumber('GRID_DEFAULT_INVESTMENT', 300),
    gridMinInvestment: readNumber('GRID_MIN_INVESTMENT', 200),
    gridMaxInvestment: readNumber('GRID_MAX_INVESTMENT', 400),
    gridRangeFor6GridsMaxPercent: readNumber('GRID_RANGE_FOR_6_GRIDS_MAX_PERCENT', 5),
    gridRangeFor8GridsMaxPercent: readNumber('GRID_RANGE_FOR_8_GRIDS_MAX_PERCENT', 10),
    gridRangeFor10GridsMaxPercent: readNumber('GRID_RANGE_FOR_10_GRIDS_MAX_PERCENT', 20),
    gridMaxAutoGrids: Math.max(6, Math.floor(readNumber('GRID_MAX_AUTO_GRIDS', 10))),
    aiEnabled: readBoolean('AI_ENABLED', false),
    aiModel: process.env.AI_MODEL ?? '',
    aiTimeoutMs: Math.max(500, Math.floor(readNumber('AI_TIMEOUT_MS', 8_000))),
    aiMaxRetries: Math.max(0, Math.floor(readNumber('AI_MAX_RETRIES', 1))),
    aiMaxCandidates: Math.max(1, Math.floor(readNumber('AI_MAX_CANDIDATES', 5))),
    aiApiUrl: process.env.AI_API_URL,
    aiApiKey: process.env.AI_API_KEY
  };
}
