import { BackfillError } from './backtest.errors.js';
import { buildQuality, isCompleteAt, normalizeCandles, parseKlineRow } from './candle-utils.js';
import {
  BYBIT_INTERVAL,
  TIMEFRAME_MS,
  type BacktestTimeframe,
  type CandleSeries,
  type RawCandle
} from './backtest.types.js';

/** Bybit v5 /market/kline maximum page size (verified: limit=1001 is clamped to 1000). */
export const KLINE_PAGE_LIMIT = 1000;

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export interface BackfillOptions {
  baseUrl: string;
  fetchFn?: FetchLike;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  requestDelayMs?: number;
  timeoutMs?: number;
  maxPages?: number;
  sleep?: (ms: number) => Promise<void>;
}

interface KlineResponse {
  retCode: number;
  retMsg: string;
  result?: { list?: unknown[] };
}

// Bybit codes meaning "slow down"; treated as retryable.
const RATE_LIMIT_RET_CODES = new Set([10006, 10018]);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Read-only public kline backfill. Any page that cannot be fetched after retries
 * aborts the whole series with a BackfillError; a partial dataset is never returned.
 */
export class BybitKlineBackfill {
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly requestDelayMs: number;
  private readonly timeoutMs: number;
  private readonly maxPages: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: BackfillOptions) {
    const trimmed = options.baseUrl.trim();
    if (!trimmed) throw new BackfillError('MISSING_BASE_URL', 'BYBIT_API_BASE_URL must be configured');
    this.baseUrl = trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
    this.fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
    this.maxRetries = options.maxRetries ?? 4;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 500;
    this.requestDelayMs = options.requestDelayMs ?? 120;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxPages = options.maxPages ?? 200;
    this.sleep = options.sleep ?? defaultSleep;
  }

  /**
   * Fetches every candle whose open time is in [startMs, cutoffMs) and that is
   * complete at cutoffMs. Pagination walks backwards by moving `end` to
   * (oldest returned open time - 1). Each page must make strict progress.
   */
  async fetchSeries(
    symbol: string,
    timeframe: BacktestTimeframe,
    startMs: number,
    cutoffMs: number
  ): Promise<CandleSeries> {
    const tfMs = TIMEFRAME_MS[timeframe];
    if (startMs % tfMs !== 0) {
      throw new BackfillError('UNALIGNED_START', `startMs must be aligned to ${timeframe}`);
    }
    if (cutoffMs <= startMs) {
      throw new BackfillError('INVALID_WINDOW', 'cutoffMs must be greater than startMs');
    }

    const collected: RawCandle[] = [];
    let cursorEnd = cutoffMs - 1;
    let pages = 0;

    for (;;) {
      if (pages >= this.maxPages) {
        throw new BackfillError(
          'PAGE_LIMIT_EXCEEDED',
          `Page cap ${this.maxPages} reached for ${symbol} ${timeframe}; refusing to return partial data`
        );
      }

      const rows = await this.fetchPage(symbol, timeframe, startMs, cursorEnd);
      pages += 1;
      if (rows.length === 0) break;

      const parsed = rows.map((row) => parseKlineRow(row, `${symbol} ${timeframe}`));
      collected.push(...parsed);

      const oldest = Math.min(...parsed.map((c) => c.timestamp));
      if (!(oldest <= cursorEnd)) {
        throw new BackfillError('NO_PAGINATION_PROGRESS', `Pagination did not progress for ${symbol} ${timeframe}`);
      }
      // A short page means the window is exhausted; a full page may have more.
      if (parsed.length < KLINE_PAGE_LIMIT || oldest <= startMs) break;
      cursorEnd = oldest - 1;
      if (this.requestDelayMs > 0) await this.sleep(this.requestDelayMs);
    }

    const normalized = normalizeCandles(collected, tfMs);

    let outOfWindowDropped = 0;
    let incompleteExcluded = 0;
    const candles = normalized.candles.filter((candle) => {
      if (candle.timestamp < startMs || candle.timestamp >= cutoffMs) {
        outOfWindowDropped += 1;
        return false;
      }
      if (!isCompleteAt(candle, tfMs, cutoffMs)) {
        incompleteExcluded += 1;
        return false;
      }
      return true;
    });

    return {
      symbol,
      timeframe,
      candles,
      quality: buildQuality({
        candles,
        timeframeMs: tfMs,
        requestedStartMs: startMs,
        cutoffMs,
        duplicatesRemoved: normalized.duplicatesRemoved,
        conflictingDuplicates: normalized.conflictingDuplicates,
        misalignedDropped: normalized.misalignedDropped,
        incompleteExcluded,
        outOfWindowDropped,
        pages
      })
    };
  }

  private async fetchPage(
    symbol: string,
    timeframe: BacktestTimeframe,
    startMs: number,
    endMs: number
  ): Promise<unknown[]> {
    const url = new URL('v5/market/kline', this.baseUrl);
    url.searchParams.set('category', 'spot');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', BYBIT_INTERVAL[timeframe]);
    url.searchParams.set('start', String(startMs));
    url.searchParams.set('end', String(endMs));
    url.searchParams.set('limit', String(KLINE_PAGE_LIMIT));

    let lastError: BackfillError | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await this.requestOnce(url.toString(), symbol);
      } catch (error) {
        const failure =
          error instanceof BackfillError
            ? error
            : new BackfillError('NETWORK_ERROR', `Request failed for ${symbol}: ${String(error)}`, true);
        if (!failure.retryable) throw failure;
        lastError = failure;
        if (attempt < this.maxRetries) await this.sleep(this.retryBaseDelayMs * 2 ** attempt);
      }
    }

    throw new BackfillError(
      'RETRIES_EXHAUSTED',
      `Gave up on ${symbol} ${timeframe} after ${this.maxRetries + 1} attempts: ${lastError?.message ?? 'unknown'}`
    );
  }

  private async requestOnce(url: string, symbol: string): Promise<unknown[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchFn(url, { signal: controller.signal });
      if (response.status === 429 || response.status >= 500) {
        throw new BackfillError('HTTP_RETRYABLE', `HTTP ${response.status} for ${symbol}`, true);
      }
      if (!response.ok) {
        throw new BackfillError('HTTP_ERROR', `HTTP ${response.status} for ${symbol}`);
      }
      const body = (await response.json()) as KlineResponse;
      if (body.retCode !== 0) {
        throw new BackfillError(
          'BYBIT_API_ERROR',
          `Bybit error ${body.retCode} (${body.retMsg}) for ${symbol}`,
          RATE_LIMIT_RET_CODES.has(body.retCode)
        );
      }
      const list = body.result?.list;
      if (!Array.isArray(list)) {
        throw new BackfillError('MALFORMED_RESPONSE', `Missing result.list for ${symbol}`);
      }
      return list;
    } finally {
      clearTimeout(timer);
    }
  }
}
