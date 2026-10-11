import type { Candle } from '../market/market.types.js';
import { round } from '../../shared/utils/math.js';

interface LevelCluster {
  price: number;
  touches: number;
}

export interface SupportResistanceOptions {
  swingWindow: number;
  clusterPercent: number;
  minTouches: number;
}

export interface SupportResistanceResult {
  support: number;
  resistance: number;
  distanceToSupportPercent: number;
  distanceToResistancePercent: number;
}

function isSwingLow(candles: Candle[], index: number, window: number): boolean {
  const target = candles[index];
  if (!target) return false;

  for (let i = index - window; i <= index + window; i += 1) {
    if (i === index || i < 0 || i >= candles.length) continue;
    const other = candles[i];
    if (!other) continue;
    if (other.low <= target.low) return false;
  }

  return true;
}

function isSwingHigh(candles: Candle[], index: number, window: number): boolean {
  const target = candles[index];
  if (!target) return false;

  for (let i = index - window; i <= index + window; i += 1) {
    if (i === index || i < 0 || i >= candles.length) continue;
    const other = candles[i];
    if (!other) continue;
    if (other.high >= target.high) return false;
  }

  return true;
}

function addToClusters(clusters: LevelCluster[], price: number, clusterPercent: number): void {
  const cluster = clusters.find(
    (item) => Math.abs((price - item.price) / item.price) * 100 <= clusterPercent
  );

  if (!cluster) {
    clusters.push({ price, touches: 1 });
    return;
  }

  cluster.price = (cluster.price * cluster.touches + price) / (cluster.touches + 1);
  cluster.touches += 1;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const midValue = sorted[mid];
  const midPrevValue = sorted[mid - 1];
  if (midValue === undefined) return 0;
  return sorted.length % 2 !== 0 ? midValue : ((midPrevValue ?? midValue) + midValue) / 2;
}

/**
 * Used only when no swing-cluster support/resistance level qualifies.
 * A raw min/max across all candles is dominated by a single flash-wick
 * outlier candle, so the fallback instead uses the median low/high, which
 * is robust to one (or a few) extreme outlier candles.
 */
function findFallbackRange(candles: Candle[]): { low: number; high: number } {
  const low = median(candles.map((candle) => candle.low));
  const high = median(candles.map((candle) => candle.high));
  return { low, high };
}

export function calculateSupportResistance(
  candles: Candle[],
  price: number,
  options: SupportResistanceOptions
): SupportResistanceResult {
  if (candles.length === 0 || price <= 0) {
    return {
      support: price,
      resistance: price,
      distanceToSupportPercent: 0,
      distanceToResistancePercent: 0
    };
  }

  const lows: LevelCluster[] = [];
  const highs: LevelCluster[] = [];

  for (let i = options.swingWindow; i < candles.length - options.swingWindow; i += 1) {
    const candle = candles[i];
    if (!candle) continue;

    if (isSwingLow(candles, i, options.swingWindow)) {
      addToClusters(lows, candle.low, options.clusterPercent);
    }

    if (isSwingHigh(candles, i, options.swingWindow)) {
      addToClusters(highs, candle.high, options.clusterPercent);
    }
  }

  const lowClusters = lows.filter((item) => item.touches >= options.minTouches);
  const highClusters = highs.filter((item) => item.touches >= options.minTouches);

  const fallback = findFallbackRange(candles);

  const supportLevel =
    lowClusters
      .filter((item) => item.price <= price)
      .sort((a, b) => b.touches - a.touches || b.price - a.price)[0]?.price ?? Math.min(fallback.low, price);

  const resistanceLevel =
    highClusters
      .filter((item) => item.price >= price)
      .sort((a, b) => b.touches - a.touches || a.price - b.price)[0]?.price ?? Math.max(fallback.high, price);

  const distanceToSupportPercent = ((price - supportLevel) / price) * 100;
  const distanceToResistancePercent = ((resistanceLevel - price) / price) * 100;

  return {
    support: round(supportLevel),
    resistance: round(resistanceLevel),
    distanceToSupportPercent: round(Math.max(0, distanceToSupportPercent)),
    distanceToResistancePercent: round(Math.max(0, distanceToResistancePercent))
  };
}
