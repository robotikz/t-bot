import type { HistoricalDataset, HorizonOutcome, Observation } from './backtest.types.js';
import { horizonKey } from './historical-evaluator.js';

export interface HorizonStats {
  observations: number;
  inside: number;
  brokeBelow: number;
  brokeAbove: number;
  insufficientFuture: number;
  /** Observations with a definitive outcome: inside + brokeBelow + brokeAbove. */
  resolved: number;
  /** inside / resolved. null when nothing resolved. INSUFFICIENT_FUTURE is never counted as survival. */
  rangeSurvivalRate: number | null;
  downsideBreakRate: number | null;
  upsideBreakRate: number | null;
  ambiguousSameCandleBreaks: number;
  /** Max excursion beyond the bound over the whole observed window, for resolved observations that pierced that side at any time. */
  downsideMagnitude: MagnitudeStats;
  upsideMagnitude: MagnitudeStats;
}

export interface MagnitudeStats {
  count: number;
  mean: number | null;
  median: number | null;
  p90: number | null;
  max: number | null;
}

export type GroupReport = Record<string, HorizonStats>;

const r4 = (n: number) => Number(n.toFixed(4));

function magnitude(values: number[]): MagnitudeStats {
  if (values.length === 0) return { count: 0, mean: null, median: null, p90: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] as number;
  return {
    count: sorted.length,
    mean: r4(sorted.reduce((s, v) => s + v, 0) / sorted.length),
    median: r4(pick(0.5)),
    p90: r4(pick(0.9)),
    max: r4(sorted[sorted.length - 1] as number)
  };
}

export function summarize(outcomes: readonly HorizonOutcome[]): HorizonStats {
  let inside = 0;
  let below = 0;
  let above = 0;
  let insufficient = 0;
  let ambiguous = 0;
  const down: number[] = [];
  const up: number[] = [];

  for (const o of outcomes) {
    if (o.outcome === 'INSUFFICIENT_FUTURE') {
      insufficient += 1;
      continue;
    }
    if (o.outcome === 'INSIDE') inside += 1;
    if (o.outcome === 'BROKE_BELOW') below += 1;
    if (o.outcome === 'BROKE_ABOVE') above += 1;
    if (o.ambiguousSameCandle) ambiguous += 1;
    if (o.maxDownsidePercent > 0) down.push(o.maxDownsidePercent);
    if (o.maxUpsidePercent > 0) up.push(o.maxUpsidePercent);
  }

  const resolved = inside + below + above;
  const rate = (n: number) => (resolved > 0 ? r4(n / resolved) : null);
  return {
    observations: outcomes.length,
    inside,
    brokeBelow: below,
    brokeAbove: above,
    insufficientFuture: insufficient,
    resolved,
    rangeSurvivalRate: rate(inside),
    downsideBreakRate: rate(below),
    upsideBreakRate: rate(above),
    ambiguousSameCandleBreaks: ambiguous,
    downsideMagnitude: magnitude(down),
    upsideMagnitude: magnitude(up)
  };
}

export function scoreBand(score: number): string {
  if (score >= 80) return '80-100';
  if (score >= 60) return '60-80';
  if (score >= 40) return '40-60';
  return '0-40';
}

function group(
  observations: readonly Observation[],
  horizons: readonly number[],
  pick: (o: Observation) => Record<string, HorizonOutcome> | null
): GroupReport {
  const report: GroupReport = {};
  for (const h of horizons) {
    const key = horizonKey(h);
    const outcomes: HorizonOutcome[] = [];
    for (const o of observations) {
      const outcome = pick(o)?.[key];
      if (outcome) outcomes.push(outcome);
    }
    report[key] = summarize(outcomes);
  }
  return report;
}

function by(
  observations: readonly Observation[],
  horizons: readonly number[],
  keyOf: (o: Observation) => string | null,
  pick: (o: Observation) => Record<string, HorizonOutcome> | null
): Record<string, GroupReport> {
  const buckets = new Map<string, Observation[]>();
  for (const o of observations) {
    const k = keyOf(o);
    if (k === null) continue;
    const list = buckets.get(k);
    if (list) list.push(o);
    else buckets.set(k, [o]);
  }
  const out: Record<string, GroupReport> = {};
  for (const k of [...buckets.keys()].sort()) out[k] = group(buckets.get(k) ?? [], horizons, pick);
  return out;
}

function count<T extends string>(values: readonly T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export interface BacktestReport {
  disclaimer: string;
  parameters: {
    quoteCoin: string;
    startMs: number;
    cutoffMs: number;
    start: string;
    cutoff: string;
    stepHours: number;
    horizonHours: number[];
    firstEvalMs: number | null;
    lastEvalMs: number | null;
    evaluationTimestamps: number;
  };
  assumptions: string[];
  dataCoverage: {
    symbolsInUniverse: number;
    symbolsWithData: number;
    excludedSymbols: Array<{ symbol: string; reason: string }>;
    perSymbol: Array<{
      symbol: string;
      timeframe: string;
      expected: number;
      actual: number;
      coverageRatio: number;
      firstCandle: string | null;
      lastCandle: string | null;
      headMissing: number;
      tailMissing: number;
      gapCount: number;
      missingInGaps: number;
      duplicatesRemoved: number;
      conflictingDuplicates: number;
      incompleteExcluded: number;
    }>;
    gaps: Array<{ symbol: string; timeframe: string; after: string; before: string; missing: number }>;
  };
  observationCounts: {
    total: number;
    byKind: Record<string, number>;
    exclusionReasons: Record<string, number>;
    scannedByStatus: Record<string, number>;
    rejectionReasons: Record<string, number>;
    scannedByEntryTiming: Record<string, number>;
    observationsWithMissingCandlesInAnalysisWindow: number;
  };
  /** Scanner 1h range, all scanned observations. */
  overall: GroupReport;
  byStatus: Record<string, GroupReport>;
  byScoreBand: Record<string, GroupReport>;
  byTrendRegime1h: Record<string, GroupReport>;
  bySymbol: Record<string, GroupReport>;
  byEntryTiming: Record<string, GroupReport>;
  /** recommendedGridRange outcomes; READY observations only. */
  recommendedGridRange: GroupReport;
  /** Same symbols and timestamps with no scanner filtering. */
  baseline: {
    overall: GroupReport;
    bySymbol: Record<string, GroupReport>;
    byTrendRegime1h: Record<string, GroupReport>;
  };
}

export const REPORT_DISCLAIMER =
  'Range suitability and break statistics only. Not simulated trading: no grid orders, fills, fees, spread, slippage or inventory are modelled, and no profitability is claimed.';

export const REPORT_ASSUMPTIONS: string[] = [
  'Data: Bybit public /v5/market/kline (spot) from the configured BYBIT_API_BASE_URL; 15m and 1h only. Read-only.',
  'Only candles fully closed at the dataset cutoff are stored; candles are never interpolated or filled.',
  'At each evaluation timestamp the unmodified production ScannerService/AnalysisService run against candles closed at that timestamp only.',
  'price = close of the last closed 15m candle. Live tickers are never used.',
  'turnover24h = sum of turnover of the 24 closed hourly candles ending at the evaluation hour; an approximation, not Bybit\'s historical ticker value. Missing hourly candles make the ticker unavailable (observation excluded).',
  'change24hPercent = price / close of the hourly candle that ended 24h earlier - 1. Bid/ask are unavailable and omitted.',
  'Production thresholds (including MIN_TURNOVER_24H_USDT=1,000,000 applied to USDC pairs) are unchanged. Symbols below the turnover threshold are not analyzed by the scanner and are reported as PREFILTERED_LOW_TURNOVER.',
  'Range under test = scanner 1h analysis rangeLow/rangeHigh (200 closed 1h candles). recommendedGridRange is evaluated separately and exists only for READY entry timing.',
  'A break is a 15m candle low < range low or high > range high within [asOf, asOf + horizon). The first breaching candle decides; a candle piercing both bounds counts as BROKE_BELOW (conservative) and is flagged.',
  'INSIDE requires every expected 15m candle in the horizon window. Otherwise INSUFFICIENT_FUTURE, which is excluded from survival and break rates and never counted as success.',
  'Break magnitudes are the maximum excursion beyond the bound over the whole observed window, in % of that bound.',
  'Survivorship bias: the instrument universe is the CURRENT live USDC list; delisted pairs are absent and pairs listed mid-window only have data from their listing.',
  'Overlapping horizons and consecutive evaluation timestamps are autocorrelated; observations are not independent, so counts overstate statistical confidence. Results cover one ~90 day market period.',
  'Baseline = scanner range function over the same 1h window applied to every symbol with a ticker at the same timestamps, with no status filtering.'
];

export function buildReport(params: {
  dataset: HistoricalDataset;
  observations: readonly Observation[];
  horizonHours: readonly number[];
  stepHours: number;
  firstEvalMs: number | null;
  lastEvalMs: number | null;
  evaluationTimestamps: number;
}): BacktestReport {
  const { dataset, observations, horizonHours, stepHours } = params;
  const scanned = observations.filter((o) => o.kind === 'SCANNED');
  const withBaseline = observations.filter((o) => o.baselineHorizons !== null);
  const scannerPick = (o: Observation) => o.horizons;
  const baselinePick = (o: Observation) => o.baselineHorizons;

  const perSymbol: BacktestReport['dataCoverage']['perSymbol'] = [];
  const gaps: BacktestReport['dataCoverage']['gaps'] = [];
  for (const symbol of [...dataset.seriesQuality.keys()].sort()) {
    const quality = dataset.seriesQuality.get(symbol);
    if (!quality) continue;
    for (const timeframe of ['15m', '1h'] as const) {
      const q = quality[timeframe];
      perSymbol.push({
        symbol,
        timeframe,
        expected: q.expectedCount,
        actual: q.actualCount,
        coverageRatio: q.coverageRatio,
        firstCandle: q.firstTimestamp === null ? null : new Date(q.firstTimestamp).toISOString(),
        lastCandle: q.lastTimestamp === null ? null : new Date(q.lastTimestamp).toISOString(),
        headMissing: q.headMissingCount,
        tailMissing: q.tailMissingCount,
        gapCount: q.gaps.length,
        missingInGaps: q.missingInGapsCount,
        duplicatesRemoved: q.duplicatesRemoved,
        conflictingDuplicates: q.conflictingDuplicates,
        incompleteExcluded: q.incompleteExcluded
      });
      for (const gap of q.gaps) {
        gaps.push({
          symbol,
          timeframe,
          after: new Date(gap.afterTimestamp).toISOString(),
          before: new Date(gap.beforeTimestamp).toISOString(),
          missing: gap.missingCount
        });
      }
    }
  }

  return {
    disclaimer: REPORT_DISCLAIMER,
    parameters: {
      quoteCoin: dataset.quoteCoin,
      startMs: dataset.startMs,
      cutoffMs: dataset.cutoffMs,
      start: new Date(dataset.startMs).toISOString(),
      cutoff: new Date(dataset.cutoffMs).toISOString(),
      stepHours,
      horizonHours: [...horizonHours],
      firstEvalMs: params.firstEvalMs,
      lastEvalMs: params.lastEvalMs,
      evaluationTimestamps: params.evaluationTimestamps
    },
    assumptions: REPORT_ASSUMPTIONS,
    dataCoverage: {
      symbolsInUniverse: dataset.instruments.length,
      symbolsWithData: dataset.series.size,
      excludedSymbols: dataset.excludedSymbols,
      perSymbol,
      gaps
    },
    observationCounts: {
      total: observations.length,
      byKind: count(observations.map((o) => o.kind)),
      exclusionReasons: count(observations.filter((o) => o.exclusionReason).map((o) => o.exclusionReason as string)),
      scannedByStatus: count(scanned.map((o) => o.status ?? 'UNKNOWN')),
      rejectionReasons: count(scanned.flatMap((o) => o.rejectionReasons)),
      scannedByEntryTiming: count(scanned.map((o) => o.entryTiming ?? 'UNKNOWN')),
      observationsWithMissingCandlesInAnalysisWindow: scanned.filter(
        (o) => (o.missing1hInWindow ?? 0) > 0 || (o.missing15mInWindow ?? 0) > 0
      ).length
    },
    overall: group(scanned, horizonHours, scannerPick),
    byStatus: by(scanned, horizonHours, (o) => o.status, scannerPick),
    byScoreBand: by(scanned, horizonHours, (o) => (o.score === null ? null : scoreBand(o.score)), scannerPick),
    byTrendRegime1h: by(scanned, horizonHours, (o) => o.trend1h, scannerPick),
    bySymbol: by(scanned, horizonHours, (o) => o.symbol, scannerPick),
    byEntryTiming: by(scanned, horizonHours, (o) => o.entryTiming, scannerPick),
    recommendedGridRange: group(scanned, horizonHours, (o) => o.gridRangeHorizons),
    baseline: {
      overall: group(withBaseline, horizonHours, baselinePick),
      bySymbol: by(withBaseline, horizonHours, (o) => o.symbol, baselinePick),
      byTrendRegime1h: by(withBaseline, horizonHours, (o) => o.trend1h ?? 'NOT_SCANNED', baselinePick)
    }
  };
}

function pct(n: number | null): string {
  return n === null ? 'n/a' : `${(n * 100).toFixed(1)}%`;
}

function table(report: GroupReport, key: string): string {
  const s = report[key];
  if (!s) return '';
  return `${s.observations} | ${s.resolved} | ${s.insufficientFuture} | ${pct(s.rangeSurvivalRate)} | ${pct(s.downsideBreakRate)} | ${pct(s.upsideBreakRate)} | ${s.downsideMagnitude.median ?? 'n/a'} | ${s.downsideMagnitude.p90 ?? 'n/a'}`;
}

export function renderMarkdown(report: BacktestReport): string {
  const lines: string[] = [];
  const hs = report.parameters.horizonHours.map(horizonKey);
  lines.push('# Spot Grid scanner — historical range-suitability report', '');
  lines.push(`> ${report.disclaimer}`, '');
  lines.push(
    `Window: ${report.parameters.start} → ${report.parameters.cutoff} (${report.parameters.quoteCoin}), step ${report.parameters.stepHours}h, ${report.parameters.evaluationTimestamps} evaluation timestamps.`,
    ''
  );
  lines.push('## Assumptions', '', ...report.assumptions.map((a) => `- ${a}`), '');
  lines.push('## Data coverage', '');
  lines.push(
    `Universe ${report.dataCoverage.symbolsInUniverse}, with data ${report.dataCoverage.symbolsWithData}, excluded ${report.dataCoverage.excludedSymbols.length}. Gaps: ${report.dataCoverage.gaps.length}. Details in report.json.`,
    ''
  );
  lines.push('## Observation counts', '', '```json', JSON.stringify(report.observationCounts, null, 2), '```', '');

  const section = (title: string, groups: Record<string, GroupReport>) => {
    lines.push(`## ${title}`, '');
    for (const h of hs) {
      lines.push(`### Horizon ${h}`, '', '| group | n | resolved | insufficient | survival | below | above | median down % | p90 down % |', '|---|---|---|---|---|---|---|---|---|');
      for (const [name, g] of Object.entries(groups)) lines.push(`| ${name} | ${table(g, h)} |`);
      lines.push('');
    }
  };

  section('Scanner overall', { ALL_SCANNED: report.overall });
  section('By candidate status', report.byStatus);
  section('By score band', report.byScoreBand);
  section('By 1h trend regime', report.byTrendRegime1h);
  section('By entry timing', report.byEntryTiming);
  section('recommendedGridRange (READY only)', { READY: report.recommendedGridRange });
  section('Baseline (no scanner filtering, same symbols/timestamps)', { BASELINE_ALL: report.baseline.overall });
  section('By symbol (scanner)', report.bySymbol);
  section('By symbol (baseline)', report.baseline.bySymbol);
  return lines.join('\n');
}
