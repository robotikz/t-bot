import type { MarketInstrument } from '@trading-platform/shared';
import { buildQuality } from '../../src/modules/backtest/candle-utils.js';
import {
  TIMEFRAME_MS,
  type BacktestTimeframe,
  type HistoricalDataset,
  type RawCandle
} from '../../src/modules/backtest/backtest.types.js';
import type { FetchLike } from '../../src/modules/backtest/kline-backfill.js';

export const T0 = Date.UTC(2026, 0, 1);
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** Deterministic oscillating price path; `seed` shifts the phase so symbols differ. */
export function makeCandles(
  timeframe: BacktestTimeframe,
  startMs: number,
  endMs: number,
  seed = 0
): RawCandle[] {
  const tf = TIMEFRAME_MS[timeframe];
  const out: RawCandle[] = [];
  for (let t = startMs; t + tf <= endMs; t += tf) {
    const i = (t - startMs) / TIMEFRAME_MS['15m'];
    const base = 100 + 4 * Math.sin((i + seed) / 40) + Math.sin((i + seed) / 7);
    const open = base;
    const close = base + 0.3 * Math.sin((i + seed) / 3);
    out.push({
      timestamp: t,
      open,
      high: Math.max(open, close) + 0.4,
      low: Math.min(open, close) - 0.4,
      close,
      volume: 1000,
      turnover: timeframe === '1h' ? 200_000 : 50_000
    });
  }
  return out;
}

export function makeInstrument(symbol: string): MarketInstrument {
  return { symbol, baseCoin: symbol.replace('USDC', ''), quoteCoin: 'USDC', status: 'Trading' };
}

export function makeDataset(
  options: {
    symbols?: string[];
    days?: number;
    mutate?: (symbol: string, tf: BacktestTimeframe, candles: RawCandle[]) => RawCandle[];
  } = {}
): HistoricalDataset {
  const symbols = options.symbols ?? ['AAAUSDC'];
  const cutoffMs = T0 + (options.days ?? 20) * DAY;
  const series = new Map<string, { '15m': readonly RawCandle[]; '1h': readonly RawCandle[] }>();
  const seriesQuality = new Map<string, Record<BacktestTimeframe, ReturnType<typeof buildQuality>>>();

  symbols.forEach((symbol, index) => {
    const build = (tf: BacktestTimeframe) => {
      const raw = makeCandles(tf, T0, cutoffMs, index * 11);
      return options.mutate ? options.mutate(symbol, tf, raw) : raw;
    };
    const c15 = build('15m');
    const c1h = build('1h');
    const quality = (candles: RawCandle[], tf: BacktestTimeframe) =>
      buildQuality({
        candles,
        timeframeMs: TIMEFRAME_MS[tf],
        requestedStartMs: T0,
        cutoffMs,
        duplicatesRemoved: 0,
        conflictingDuplicates: 0,
        misalignedDropped: 0,
        incompleteExcluded: 0,
        outOfWindowDropped: 0,
        pages: 0
      });
    series.set(symbol, { '15m': c15, '1h': c1h });
    seriesQuality.set(symbol, { '15m': quality(c15, '15m'), '1h': quality(c1h, '1h') });
  });

  return {
    quoteCoin: 'USDC',
    startMs: T0,
    cutoffMs,
    instruments: symbols.map(makeInstrument),
    series,
    seriesQuality,
    excludedSymbols: []
  };
}

function row(c: RawCandle): string[] {
  return [c.timestamp, c.open, c.high, c.low, c.close, c.volume, c.turnover].map(String);
}

/** Mimics Bybit /v5/market/kline: inclusive start/end on open time, newest first, limit <= 1000. */
export function makeKlineFetch(
  master: RawCandle[],
  hooks: { onRequest?: (url: URL) => void; failures?: Array<() => ReturnType<FetchLike>> } = {}
): FetchLike {
  return async (url) => {
    const failure = hooks.failures?.shift();
    if (failure) return failure();
    const u = new URL(url);
    hooks.onRequest?.(u);
    const start = Number(u.searchParams.get('start'));
    const end = Number(u.searchParams.get('end'));
    const limit = Math.min(Number(u.searchParams.get('limit')), 1000);
    const list = master
      .filter((c) => c.timestamp >= start && c.timestamp <= end)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(row);
    return { ok: true, status: 200, json: async () => ({ retCode: 0, retMsg: 'OK', result: { list } }) };
  };
}

export const httpResponse = (status: number, body: unknown = {}): ReturnType<FetchLike> =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
