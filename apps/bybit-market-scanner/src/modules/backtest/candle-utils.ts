import { BackfillError } from './backtest.errors.js';
import type { RawCandle, SeriesGap, SeriesQuality } from './backtest.types.js';

/**
 * Parses one Bybit kline row: [startTime, open, high, low, close, volume, turnover].
 * Malformed rows abort the backfill; they are never skipped silently.
 */
export function parseKlineRow(row: unknown, context: string): RawCandle {
  if (!Array.isArray(row) || row.length < 7) {
    throw new BackfillError('MALFORMED_KLINE', `Malformed kline row for ${context}`);
  }
  const [timestamp, open, high, low, close, volume, turnover] = row.slice(0, 7).map((v) => Number(v));
  const values = [timestamp, open, high, low, close, volume, turnover];
  if (values.some((v) => v === undefined || !Number.isFinite(v))) {
    throw new BackfillError('MALFORMED_KLINE', `Non-numeric kline field for ${context}`);
  }
  const candle: RawCandle = {
    timestamp: timestamp as number,
    open: open as number,
    high: high as number,
    low: low as number,
    close: close as number,
    volume: volume as number,
    turnover: turnover as number
  };
  if (candle.high < candle.low) {
    throw new BackfillError('MALFORMED_KLINE', `Kline high < low for ${context} at ${candle.timestamp}`);
  }
  return candle;
}

function serialize(c: RawCandle): string {
  return JSON.stringify([c.timestamp, c.open, c.high, c.low, c.close, c.volume, c.turnover]);
}

export interface NormalizeResult {
  candles: RawCandle[];
  duplicatesRemoved: number;
  conflictingDuplicates: number;
  misalignedDropped: number;
}

/**
 * Sorts ascending and deduplicates by timestamp. Duplicate resolution is
 * order-independent: the lexicographically smallest serialization wins, so the
 * same multiset of rows always produces the same output.
 */
export function normalizeCandles(input: readonly RawCandle[], timeframeMs: number): NormalizeResult {
  const groups = new Map<number, RawCandle[]>();
  let misalignedDropped = 0;

  for (const candle of input) {
    if (candle.timestamp % timeframeMs !== 0) {
      misalignedDropped += 1;
      continue;
    }
    const group = groups.get(candle.timestamp);
    if (group) group.push(candle);
    else groups.set(candle.timestamp, [candle]);
  }

  let duplicatesRemoved = 0;
  let conflictingDuplicates = 0;
  const candles: RawCandle[] = [];

  for (const timestamp of [...groups.keys()].sort((a, b) => a - b)) {
    const group = groups.get(timestamp) ?? [];
    const keyed = group.map((candle) => ({ candle, key: serialize(candle) }));
    if (keyed.length > 1) {
      duplicatesRemoved += keyed.length - 1;
      if (new Set(keyed.map((k) => k.key)).size > 1) conflictingDuplicates += 1;
    }
    keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const chosen = keyed[0];
    if (chosen) candles.push(chosen.candle);
  }

  return { candles, duplicatesRemoved, conflictingDuplicates, misalignedDropped };
}

/** A candle is complete at `cutoffMs` only if its whole interval has elapsed. */
export function isCompleteAt(candle: RawCandle, timeframeMs: number, cutoffMs: number): boolean {
  return candle.timestamp + timeframeMs <= cutoffMs;
}

/** Reports missing intervals between consecutive candles. Never fills them. */
export function findGaps(candles: readonly RawCandle[], timeframeMs: number): SeriesGap[] {
  const gaps: SeriesGap[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    const previous = candles[i - 1];
    const current = candles[i];
    if (!previous || !current) continue;
    const diff = current.timestamp - previous.timestamp;
    if (diff > timeframeMs) {
      gaps.push({
        afterTimestamp: previous.timestamp,
        beforeTimestamp: current.timestamp,
        missingCount: diff / timeframeMs - 1
      });
    }
  }
  return gaps;
}

export function buildQuality(params: {
  candles: readonly RawCandle[];
  timeframeMs: number;
  requestedStartMs: number;
  cutoffMs: number;
  duplicatesRemoved: number;
  conflictingDuplicates: number;
  misalignedDropped: number;
  incompleteExcluded: number;
  outOfWindowDropped: number;
  pages: number;
}): SeriesQuality {
  const { candles, timeframeMs, requestedStartMs, cutoffMs } = params;
  const first = candles[0];
  const last = candles[candles.length - 1];
  const expectedCount = Math.max(0, Math.floor((cutoffMs - requestedStartMs) / timeframeMs));
  const gaps = findGaps(candles, timeframeMs);
  const missingInGapsCount = gaps.reduce((sum, gap) => sum + gap.missingCount, 0);

  return {
    requestedStartMs,
    cutoffMs,
    expectedCount,
    actualCount: candles.length,
    firstTimestamp: first ? first.timestamp : null,
    lastTimestamp: last ? last.timestamp : null,
    headMissingCount: first
      ? Math.max(0, Math.floor((first.timestamp - requestedStartMs) / timeframeMs))
      : expectedCount,
    tailMissingCount: last
      ? Math.max(0, Math.floor((cutoffMs - timeframeMs - last.timestamp) / timeframeMs))
      : 0,
    gaps,
    missingInGapsCount,
    duplicatesRemoved: params.duplicatesRemoved,
    conflictingDuplicates: params.conflictingDuplicates,
    misalignedDropped: params.misalignedDropped,
    incompleteExcluded: params.incompleteExcluded,
    outOfWindowDropped: params.outOfWindowDropped,
    pages: params.pages,
    coverageRatio: expectedCount > 0 ? Number((candles.length / expectedCount).toFixed(6)) : 0
  };
}
