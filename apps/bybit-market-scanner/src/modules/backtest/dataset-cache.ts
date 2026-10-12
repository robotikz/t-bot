import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MarketInstrument } from '@trading-platform/shared';
import { BackfillError } from './backtest.errors.js';
import { buildQuality, isCompleteAt, normalizeCandles } from './candle-utils.js';
import type { BybitKlineBackfill } from './kline-backfill.js';
import {
  BACKTEST_TIMEFRAMES,
  TIMEFRAME_MS,
  type BacktestTimeframe,
  type CandleSeries,
  type HistoricalDataset,
  type RawCandle,
  type SeriesQuality
} from './backtest.types.js';

export const CACHE_FORMAT_VERSION = 1;

interface CacheFile {
  formatVersion: number;
  source: 'bybit-v5-market-kline';
  category: 'spot';
  symbol: string;
  timeframe: BacktestTimeframe;
  startMs: number;
  cutoffMs: number;
  /** Rows: [openTimeMs, open, high, low, close, volume, turnover], ascending, unique, closed at cutoffMs. */
  candles: Array<[number, number, number, number, number, number, number]>;
  quality: SeriesQuality;
}

function seriesPath(dir: string, symbol: string, timeframe: BacktestTimeframe): string {
  if (!/^[A-Z0-9]+$/.test(symbol)) throw new BackfillError('INVALID_SYMBOL', `Unsafe symbol: ${symbol}`);
  return join(dir, 'candles', `${symbol}_${timeframe}.json`);
}

async function writeAtomic(path: string, content: string): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, path);
}

export async function writeSeriesCache(dir: string, series: CandleSeries, startMs: number, cutoffMs: number) {
  await mkdir(join(dir, 'candles'), { recursive: true });
  const file: CacheFile = {
    formatVersion: CACHE_FORMAT_VERSION,
    source: 'bybit-v5-market-kline',
    category: 'spot',
    symbol: series.symbol,
    timeframe: series.timeframe,
    startMs,
    cutoffMs,
    candles: series.candles.map((c) => [c.timestamp, c.open, c.high, c.low, c.close, c.volume, c.turnover]),
    quality: series.quality
  };
  await writeAtomic(seriesPath(dir, series.symbol, series.timeframe), JSON.stringify(file));
}

/**
 * Returns the cached series only if it exactly matches the requested window and
 * re-validates cleanly. Anything else is treated as a cache miss.
 */
export async function readSeriesCache(
  dir: string,
  symbol: string,
  timeframe: BacktestTimeframe,
  startMs: number,
  cutoffMs: number
): Promise<CandleSeries | null> {
  let raw: string;
  try {
    raw = await readFile(seriesPath(dir, symbol, timeframe), 'utf8');
  } catch {
    return null;
  }
  let file: CacheFile;
  try {
    file = JSON.parse(raw) as CacheFile;
  } catch {
    return null;
  }
  if (
    file.formatVersion !== CACHE_FORMAT_VERSION ||
    file.symbol !== symbol ||
    file.timeframe !== timeframe ||
    file.startMs !== startMs ||
    file.cutoffMs !== cutoffMs ||
    !Array.isArray(file.candles)
  ) {
    return null;
  }

  const tfMs = TIMEFRAME_MS[timeframe];
  const candles: RawCandle[] = file.candles.map(([timestamp, open, high, low, close, volume, turnover]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume,
    turnover
  }));
  const normalized = normalizeCandles(candles, tfMs);
  const valid =
    normalized.candles.length === candles.length &&
    normalized.duplicatesRemoved === 0 &&
    normalized.misalignedDropped === 0 &&
    candles.every((c) => isCompleteAt(c, tfMs, cutoffMs) && c.timestamp >= startMs);
  if (!valid) return null;

  const quality = buildQuality({
    candles,
    timeframeMs: tfMs,
    requestedStartMs: startMs,
    cutoffMs,
    duplicatesRemoved: file.quality?.duplicatesRemoved ?? 0,
    conflictingDuplicates: file.quality?.conflictingDuplicates ?? 0,
    misalignedDropped: file.quality?.misalignedDropped ?? 0,
    incompleteExcluded: file.quality?.incompleteExcluded ?? 0,
    outOfWindowDropped: file.quality?.outOfWindowDropped ?? 0,
    pages: file.quality?.pages ?? 0
  });
  return { symbol, timeframe, candles, quality };
}

export interface LoadDatasetOptions {
  quoteCoin: string;
  instruments: MarketInstrument[];
  startMs: number;
  cutoffMs: number;
  cacheDir: string;
  backfill: BybitKlineBackfill | null;
  symbols?: string[];
  onProgress?: (message: string) => void;
}

/**
 * Builds the dataset from cache, fetching what is missing. If any series cannot be
 * retrieved completely, the error aggregates all failures and no dataset is returned.
 * Successfully fetched series stay cached so a re-run resumes.
 */
export async function loadHistoricalDataset(options: LoadDatasetOptions): Promise<HistoricalDataset> {
  const { quoteCoin, startMs, cutoffMs, cacheDir, backfill, onProgress } = options;
  const wanted = options.symbols ? new Set(options.symbols) : null;
  const instruments = options.instruments
    .filter((i) => i.status === 'Trading' && i.quoteCoin.toUpperCase() === quoteCoin.toUpperCase())
    .filter((i) => (wanted ? wanted.has(i.symbol) : true))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const series = new Map<string, { '15m': readonly RawCandle[]; '1h': readonly RawCandle[] }>();
  const seriesQuality = new Map<string, Record<BacktestTimeframe, SeriesQuality>>();
  const excludedSymbols: Array<{ symbol: string; reason: string }> = [];
  const failures: string[] = [];

  for (const instrument of instruments) {
    const perTf: Partial<Record<BacktestTimeframe, CandleSeries>> = {};
    let failed = false;
    for (const timeframe of BACKTEST_TIMEFRAMES) {
      let cached = await readSeriesCache(cacheDir, instrument.symbol, timeframe, startMs, cutoffMs);
      if (!cached) {
        if (!backfill) {
          failures.push(`${instrument.symbol} ${timeframe}: not cached and network disabled`);
          failed = true;
          break;
        }
        try {
          cached = await backfill.fetchSeries(instrument.symbol, timeframe, startMs, cutoffMs);
          await writeSeriesCache(cacheDir, cached, startMs, cutoffMs);
          onProgress?.(`fetched ${instrument.symbol} ${timeframe}: ${cached.candles.length} candles`);
        } catch (error) {
          failures.push(`${instrument.symbol} ${timeframe}: ${error instanceof Error ? error.message : String(error)}`);
          failed = true;
          break;
        }
      } else {
        onProgress?.(`cache hit ${instrument.symbol} ${timeframe}: ${cached.candles.length} candles`);
      }
      perTf[timeframe] = cached;
    }
    if (failed) continue;

    const s15 = perTf['15m'];
    const s1h = perTf['1h'];
    if (!s15 || !s1h) continue;
    if (s15.candles.length === 0 || s1h.candles.length === 0) {
      excludedSymbols.push({ symbol: instrument.symbol, reason: 'NO_CANDLES_IN_WINDOW' });
      continue;
    }
    series.set(instrument.symbol, { '15m': s15.candles, '1h': s1h.candles });
    seriesQuality.set(instrument.symbol, { '15m': s15.quality, '1h': s1h.quality });
  }

  if (failures.length > 0) {
    throw new BackfillError(
      'INCOMPLETE_DATASET',
      `Backfill incomplete; ${failures.length} series failed (re-run to resume from cache):\n${failures.join('\n')}`
    );
  }

  return { quoteCoin, startMs, cutoffMs, instruments, series, seriesQuality, excludedSymbols };
}
