import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BackfillError } from '../../src/modules/backtest/backtest.errors.js';
import { loadHistoricalDataset, readSeriesCache, writeSeriesCache } from '../../src/modules/backtest/dataset-cache.js';
import { BybitKlineBackfill } from '../../src/modules/backtest/kline-backfill.js';
import { DAY, HOUR, T0, httpResponse, makeCandles, makeInstrument, makeKlineFetch } from './helpers.js';
import type { FetchLike } from '../../src/modules/backtest/kline-backfill.js';

const noSleep = async () => {};
const make = (fetchFn: FetchLike, extra = {}) =>
  new BybitKlineBackfill({ baseUrl: 'https://example.test', fetchFn, sleep: noSleep, requestDelayMs: 0, ...extra });

describe('kline backfill', () => {
  it('uses the configured base URL and documented start/end/limit parameters', async () => {
    const seen: URL[] = [];
    const master = makeCandles('1h', T0, T0 + 2 * DAY);
    const b = new BybitKlineBackfill({
      baseUrl: 'https://custom-host.test',
      fetchFn: makeKlineFetch(master, { onRequest: (u) => seen.push(u) }),
      sleep: noSleep,
      requestDelayMs: 0
    });
    await b.fetchSeries('AAAUSDC', '1h', T0, T0 + 2 * DAY);
    const url = seen[0] as URL;
    expect(url.origin).toBe('https://custom-host.test');
    expect(url.pathname).toBe('/v5/market/kline');
    expect(url.searchParams.get('category')).toBe('spot');
    expect(url.searchParams.get('interval')).toBe('60');
    expect(url.searchParams.get('limit')).toBe('1000');
    expect(url.searchParams.get('start')).toBe(String(T0));
    expect(url.searchParams.get('end')).toBe(String(T0 + 2 * DAY - 1));
  });

  it('paginates across pages without skipping or duplicating intervals', async () => {
    const end = T0 + 30 * DAY; // 2880 15m candles -> 3 pages
    const master = makeCandles('15m', T0, end);
    let requests = 0;
    const s = await make(makeKlineFetch(master, { onRequest: () => (requests += 1) })).fetchSeries('AAAUSDC', '15m', T0, end);
    expect(s.candles).toHaveLength(master.length);
    expect(s.candles.map((c) => c.timestamp)).toEqual(master.map((c) => c.timestamp));
    expect(s.quality.gaps).toEqual([]);
    expect(s.quality.coverageRatio).toBe(1);
    expect(requests).toBe(3);
    expect(s.quality.pages).toBe(3);
  });

  it('reports gaps from the source and never fabricates candles', async () => {
    const end = T0 + 2 * DAY;
    const master = makeCandles('1h', T0, end).filter((c) => c.timestamp !== T0 + 5 * HOUR);
    const s = await make(makeKlineFetch(master)).fetchSeries('AAAUSDC', '1h', T0, end);
    expect(s.candles).toHaveLength(47);
    expect(s.quality.gaps).toEqual([{ afterTimestamp: T0 + 4 * HOUR, beforeTimestamp: T0 + 6 * HOUR, missingCount: 1 }]);
    expect(s.quality.missingInGapsCount).toBe(1);
    expect(s.quality.coverageRatio).toBeCloseTo(47 / 48, 5);
  });

  it('reports a late listing as head-missing instead of padding', async () => {
    const end = T0 + 2 * DAY;
    const master = makeCandles('1h', T0 + 10 * HOUR, end);
    const s = await make(makeKlineFetch(master)).fetchSeries('AAAUSDC', '1h', T0, end);
    expect(s.quality.headMissingCount).toBe(10);
    expect(s.candles[0]?.timestamp).toBe(T0 + 10 * HOUR);
  });

  it('excludes candles that are incomplete at the cutoff', async () => {
    const cutoff = T0 + 2 * DAY - 30 * 60_000; // mid-hour cutoff
    const master = makeCandles('1h', T0, T0 + 2 * DAY);
    const s = await make(makeKlineFetch(master)).fetchSeries('AAAUSDC', '1h', T0, cutoff);
    expect(s.candles.at(-1)?.timestamp).toBe(T0 + 2 * DAY - 2 * HOUR);
    expect(s.quality.incompleteExcluded).toBe(1);
  });

  it('deduplicates repeated rows returned by the API', async () => {
    const end = T0 + 6 * HOUR;
    const master = makeCandles('1h', T0, end);
    const dup = [...master, master[2]!, master[2]!];
    const s = await make(makeKlineFetch(dup)).fetchSeries('AAAUSDC', '1h', T0, end);
    expect(s.candles).toHaveLength(6);
    expect(s.quality.duplicatesRemoved).toBe(2);
  });

  it('retries 429 and transient 5xx, then succeeds with a complete series', async () => {
    const end = T0 + 6 * HOUR;
    const master = makeCandles('1h', T0, end);
    const failures = [() => httpResponse(429), () => httpResponse(503), () => httpResponse(200, { retCode: 10006, retMsg: 'rate' })];
    const s = await make(makeKlineFetch(master, { failures })).fetchSeries('AAAUSDC', '1h', T0, end);
    expect(s.candles).toHaveLength(6);
  });

  it('persistent rate limiting aborts instead of returning a partial series', async () => {
    const always429 = async () => httpResponse(429) as never;
    await expect(make(always429, { maxRetries: 2 }).fetchSeries('AAAUSDC', '1h', T0, T0 + 6 * HOUR)).rejects.toMatchObject({
      code: 'RETRIES_EXHAUSTED'
    });
  });

  it('a failure on a later page aborts the whole series (no silently truncated data)', async () => {
    const end = T0 + 30 * DAY;
    const master = makeCandles('15m', T0, end);
    const inner = makeKlineFetch(master);
    let calls = 0;
    const flaky: typeof inner = async (url, init) => {
      calls += 1;
      return calls >= 2 ? httpResponse(500) : inner(url, init);
    };
    await expect(make(flaky, { maxRetries: 1 }).fetchSeries('AAAUSDC', '15m', T0, end)).rejects.toBeInstanceOf(BackfillError);
  });

  it('non-retryable API errors and malformed rows fail fast', async () => {
    await expect(
      make(async () => httpResponse(200, { retCode: 10001, retMsg: 'bad param' }) as never).fetchSeries('AAAUSDC', '1h', T0, T0 + 6 * HOUR)
    ).rejects.toMatchObject({ code: 'BYBIT_API_ERROR' });
    const malformed = async () => httpResponse(200, { retCode: 0, retMsg: 'OK', result: { list: [['x', '1', '1', '1', '1', '1', '1']] } }) as never;
    await expect(make(malformed).fetchSeries('AAAUSDC', '1h', T0, T0 + 6 * HOUR)).rejects.toMatchObject({ code: 'MALFORMED_KLINE' });
  });

  it('guards against pagination that does not progress', async () => {
    const stuck = async () => {
      const rows = Array.from({ length: 1000 }, (_, i) => [String(T0 + 100 * DAY + i * HOUR), '1', '1', '1', '1', '1', '1']);
      return httpResponse(200, { retCode: 0, retMsg: 'OK', result: { list: rows } }) as never;
    };
    await expect(make(stuck).fetchSeries('AAAUSDC', '1h', T0, T0 + 200 * DAY)).rejects.toMatchObject({ code: 'NO_PAGINATION_PROGRESS' });
  });

  it('requires an explicit base URL', () => {
    expect(() => new BybitKlineBackfill({ baseUrl: ' ' })).toThrow(/BYBIT_API_BASE_URL/);
  });
});

describe('dataset cache', () => {
  let dir = '';
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('round-trips deterministically and rejects windows that do not match', async () => {
    dir = await mkdtemp(join(tmpdir(), 'bt-cache-'));
    const end = T0 + 2 * DAY;
    const s = await make(makeKlineFetch(makeCandles('1h', T0, end))).fetchSeries('AAAUSDC', '1h', T0, end);
    await writeSeriesCache(dir, s, T0, end);
    expect((await readSeriesCache(dir, 'AAAUSDC', '1h', T0, end))?.candles).toEqual(s.candles);
    expect(await readSeriesCache(dir, 'AAAUSDC', '1h', T0, end + HOUR)).toBeNull();
    expect(await readSeriesCache(dir, 'AAAUSDC', '15m', T0, end)).toBeNull();
  });

  it('an incomplete backfill raises INCOMPLETE_DATASET and does not return a dataset', async () => {
    dir = await mkdtemp(join(tmpdir(), 'bt-cache-'));
    const end = T0 + 2 * DAY;
    const good = makeKlineFetch([...makeCandles('1h', T0, end)]);
    const backfill = make(async (url, init) => (url.includes('symbol=BADUSDC') ? httpResponse(503) : good(url, init)) as never, {
      maxRetries: 0
    });
    await expect(
      loadHistoricalDataset({
        quoteCoin: 'USDC',
        instruments: [makeInstrument('AAAUSDC'), makeInstrument('BADUSDC')],
        startMs: T0,
        cutoffMs: end,
        cacheDir: dir,
        backfill
      })
    ).rejects.toMatchObject({ code: 'INCOMPLETE_DATASET', message: expect.stringContaining('BADUSDC') });
  });

  it('offline mode with a missing cache fails rather than producing empty data', async () => {
    dir = await mkdtemp(join(tmpdir(), 'bt-cache-'));
    await expect(
      loadHistoricalDataset({
        quoteCoin: 'USDC',
        instruments: [makeInstrument('AAAUSDC')],
        startMs: T0,
        cutoffMs: T0 + DAY,
        cacheDir: dir,
        backfill: null
      })
    ).rejects.toMatchObject({ code: 'INCOMPLETE_DATASET' });
  });
});
