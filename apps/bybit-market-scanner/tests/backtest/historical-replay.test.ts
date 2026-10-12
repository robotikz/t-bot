import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/config.js';
import {
  HistoricalEvaluator,
  buildEvaluationTimestamps,
  assertChronological,
  classifyHorizon
} from '../../src/modules/backtest/historical-evaluator.js';
import { HistoricalMarketService } from '../../src/modules/backtest/historical-market.service.js';
import { findGaps, normalizeCandles } from '../../src/modules/backtest/candle-utils.js';
import type { Observation, RawCandle } from '../../src/modules/backtest/backtest.types.js';
import { DAY, HOUR, T0, makeCandles, makeDataset } from './helpers.js';

const config = loadConfig();
const ASOF = T0 + 12 * DAY;
const HORIZONS = [24, 72, 168] as const;

/** Everything the scanner decided at scan time (excludes the forward-looking outcome fields). */
function decision(o: Observation) {
  const { horizons, gridRangeHorizons, baselineHorizons, ...rest } = o;
  void horizons;
  void gridRangeHorizons;
  void baselineHorizons;
  return rest;
}

describe('leakage: future candles cannot influence past decisions', () => {
  const baseline = makeDataset({ symbols: ['AAAUSDC', 'BBBUSDC'] });

  it('replacing every candle at/after asOf with extreme values leaves the decision unchanged', async () => {
    const corrupted = makeDataset({
      symbols: ['AAAUSDC', 'BBBUSDC'],
      mutate: (_s, tf, candles) =>
        candles.map((c) =>
          c.timestamp >= ASOF ? { ...c, open: c.open * 10, high: c.high * 10, low: c.low / 10, close: c.close * 10, turnover: 9e12 } : c
        )
    });
    const a = await new HistoricalEvaluator(baseline, config).evaluateAt(ASOF, { horizonHours: HORIZONS });
    const b = await new HistoricalEvaluator(corrupted, config).evaluateAt(ASOF, { horizonHours: HORIZONS });
    expect(a.length).toBeGreaterThan(0);
    expect(a.map(decision)).toEqual(b.map(decision));
    // Sanity: the future change is visible in the forward-looking outcome only.
    expect(JSON.stringify(a.map((o) => o.horizons))).not.toEqual(JSON.stringify(b.map((o) => o.horizons)));
  });

  it('truncating the dataset right at asOf leaves the decision unchanged', async () => {
    const truncated = makeDataset({
      symbols: ['AAAUSDC', 'BBBUSDC'],
      mutate: (_s, _tf, candles) => candles.filter((c) => c.timestamp < ASOF)
    });
    const a = await new HistoricalEvaluator(baseline, config).evaluateAt(ASOF, { horizonHours: HORIZONS });
    const b = await new HistoricalEvaluator(truncated, config).evaluateAt(ASOF, { horizonHours: HORIZONS });
    expect(a.map(decision)).toEqual(b.map(decision));
    expect(b.every((o) => Object.values(o.horizons ?? {}).every((h) => h.outcome === 'INSUFFICIENT_FUTURE'))).toBe(true);
  });

  it('negative control: changing a PAST candle does change the decision', async () => {
    const past = makeDataset({
      symbols: ['AAAUSDC', 'BBBUSDC'],
      mutate: (_s, tf, candles) =>
        candles.map((c) => (c.timestamp === ASOF - (tf === '1h' ? HOUR : 15 * 60_000) ? { ...c, close: c.close * 1.5, high: c.high * 1.5 } : c))
    });
    const a = await new HistoricalEvaluator(baseline, config).evaluateAt(ASOF, { horizonHours: HORIZONS });
    const b = await new HistoricalEvaluator(past, config).evaluateAt(ASOF, { horizonHours: HORIZONS });
    expect(JSON.stringify(a.map(decision))).not.toEqual(JSON.stringify(b.map(decision)));
  });

  it('price is the last closed 15m close, not any later candle', async () => {
    const market = new HistoricalMarketService(baseline);
    market.setAsOf(ASOF);
    const last = baseline.series.get('AAAUSDC')?.['15m'].find((c) => c.timestamp === ASOF - 15 * 60_000);
    const ticker = await market.getMarketTicker('AAAUSDC');
    expect(ticker.lastPrice).toBe(last?.close);
    expect(ticker.bidPrice).toBeUndefined();
    expect(ticker.timestamp).toBe(ASOF);
  });
});

describe('incomplete candles are excluded', () => {
  it('a candle still open at asOf is never exposed', async () => {
    const dataset = makeDataset();
    const market = new HistoricalMarketService(dataset);
    const midCandle = ASOF + 20 * 60_000; // 15m candle at ASOF+15m is open at +20m; 1h candle at ASOF is open
    market.setAsOf(midCandle);
    const c15 = await market.getCandles('AAAUSDC', '15m', 100);
    const c1h = await market.getCandles('AAAUSDC', '1h', 100);
    expect(c15.at(-1)?.timestamp).toBe(ASOF); // candle opened at ASOF closed at +15m
    expect(c1h.at(-1)?.timestamp).toBe(ASOF - HOUR); // hourly candle opened at ASOF still open
    expect([...c15, ...c1h].every((c) => c.isClosed)).toBe(true);
  });
});

describe('chronological evaluation', () => {
  it('timestamps are strictly ascending, hour-aligned, and observations never go backwards', async () => {
    const ts = buildEvaluationTimestamps(T0 + 9 * DAY + 123, T0 + 11 * DAY, 6);
    expect(ts.every((t) => t % HOUR === 0)).toBe(true);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);

    const evaluator = new HistoricalEvaluator(makeDataset(), config);
    const obs = await evaluator.evaluate({
      stepHours: 12,
      horizonHours: [24],
      firstEvalMs: T0 + 10 * DAY,
      lastEvalMs: T0 + 12 * DAY
    });
    const times = obs.map((o) => o.asOfMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(5);
  });

  it('rejects non-ascending timestamps', () => {
    expect(() => assertChronological([1, 3, 2])).toThrow(/ascending/);
    expect(() => assertChronological([1, 1])).toThrow(/ascending/);
  });
});

describe('duplicates and gaps', () => {
  it('deduplicates deterministically regardless of input order', () => {
    const tf = 15 * 60_000;
    const base = makeCandles('15m', T0, T0 + 3 * HOUR);
    const conflicting = { ...(base[3] as RawCandle), close: 999 };
    const input = [...base, base[1] as RawCandle, conflicting];
    const a = normalizeCandles(input, tf);
    const b = normalizeCandles([...input].reverse(), tf);
    expect(a.candles).toEqual(b.candles);
    expect(a.candles).toHaveLength(base.length);
    expect(a.duplicatesRemoved).toBe(2);
    expect(a.conflictingDuplicates).toBe(1);
  });

  it('reports a gap and never fills it', async () => {
    const hole = T0 + 11 * DAY + 2 * HOUR;
    const dataset = makeDataset({
      mutate: (_s, tf, candles) =>
        tf === '1h' ? candles.filter((c) => c.timestamp !== hole && c.timestamp !== hole + HOUR) : candles
    });
    const hourly = dataset.series.get('AAAUSDC')?.['1h'] ?? [];
    expect(findGaps(hourly, HOUR)).toEqual([{ afterTimestamp: hole - HOUR, beforeTimestamp: hole + 2 * HOUR, missingCount: 2 }]);
    expect(hourly.some((c) => c.timestamp === hole)).toBe(false);

    const market = new HistoricalMarketService(dataset);
    market.setAsOf(T0 + 12 * DAY);
    expect(market.missingInWindow('AAAUSDC', '1h', 200)).toBe(2);
    const candles = await market.getCandles('AAAUSDC', '1h', 200);
    expect(candles).toHaveLength(200); // 200 real candles; the hole is not padded
    expect(candles.some((c) => c.timestamp === hole)).toBe(false);
  });

  it('an incomplete 24h hourly window makes the ticker unavailable instead of estimating it', async () => {
    const hole = ASOF - 5 * HOUR;
    const dataset = makeDataset({
      mutate: (_s, tf, candles) => (tf === '1h' ? candles.filter((c) => c.timestamp !== hole) : candles)
    });
    const market = new HistoricalMarketService(dataset);
    market.setAsOf(ASOF);
    expect(market.tickerUnavailableReason('AAAUSDC')).toBe('INCOMPLETE_24H_HOURLY_WINDOW');
    const [obs] = await new HistoricalEvaluator(dataset, config).evaluateAt(ASOF, { horizonHours: [24] });
    expect(obs?.kind).toBe('EXCLUDED_NO_TICKER');
    expect(obs?.exclusionReason).toBe('INCOMPLETE_24H_HOURLY_WINDOW');
  });
});

describe('horizon classification', () => {
  const asOf = T0;
  const m15 = 15 * 60_000;
  const flat = (n: number, from = 0): RawCandle[] =>
    Array.from({ length: n }, (_, i) => ({
      timestamp: asOf + (from + i) * m15,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1,
      turnover: 1
    }));

  it('INSIDE only with a complete window', () => {
    expect(classifyHorizon(flat(96), asOf, 24 * HOUR, 98, 102).outcome).toBe('INSIDE');
  });

  it('missing future data is INSUFFICIENT_FUTURE, never INSIDE', () => {
    const r = classifyHorizon(flat(50), asOf, 24 * HOUR, 98, 102);
    expect(r.outcome).toBe('INSUFFICIENT_FUTURE');
    expect(r.missingCandles).toBe(46);
    expect(classifyHorizon([], asOf, 24 * HOUR, 98, 102).outcome).toBe('INSUFFICIENT_FUTURE');
  });

  it('a gap inside the window prevents INSIDE', () => {
    const withGap = flat(96).filter((_, i) => i !== 40);
    expect(classifyHorizon(withGap, asOf, 24 * HOUR, 98, 102).outcome).toBe('INSUFFICIENT_FUTURE');
  });

  it('an observed break is definitive even with an incomplete window; magnitudes are measured', () => {
    const c = flat(10);
    c[4] = { ...(c[4] as RawCandle), low: 90 };
    const r = classifyHorizon(c, asOf, 24 * HOUR, 98, 102);
    expect(r.outcome).toBe('BROKE_BELOW');
    expect(r.maxDownsidePercent).toBeCloseTo(((98 - 90) / 98) * 100, 3);
    expect(r.firstBreakAfterMs).toBe(4 * m15);
    const up = flat(96);
    up[70] = { ...(up[70] as RawCandle), high: 110 };
    const u = classifyHorizon(up, asOf, 24 * HOUR, 98, 102);
    expect(u.outcome).toBe('BROKE_ABOVE');
    expect(u.maxUpsidePercent).toBeCloseTo(((110 - 102) / 102) * 100, 3);
  });

  it('the first break decides; a candle piercing both bounds is conservatively BROKE_BELOW', () => {
    const c = flat(96);
    c[10] = { ...(c[10] as RawCandle), high: 110 };
    c[20] = { ...(c[20] as RawCandle), low: 90 };
    expect(classifyHorizon(c, asOf, 24 * HOUR, 98, 102).outcome).toBe('BROKE_ABOVE');
    c[5] = { ...(c[5] as RawCandle), high: 110, low: 90 };
    const r = classifyHorizon(c, asOf, 24 * HOUR, 98, 102);
    expect(r.outcome).toBe('BROKE_BELOW');
    expect(r.ambiguousSameCandle).toBe(true);
  });

  it('candles outside [asOf, asOf+horizon) are ignored', () => {
    const before = flat(5).map((c) => ({ ...c, timestamp: c.timestamp - 10 * HOUR, low: 1 }));
    const after = flat(1, 96).map((c) => ({ ...c, high: 500 }));
    const r = classifyHorizon([...before, ...flat(96), ...after], asOf, 24 * HOUR, 98, 102);
    expect(r.outcome).toBe('INSIDE');
  });
});
