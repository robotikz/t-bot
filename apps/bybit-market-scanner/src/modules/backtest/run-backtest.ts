import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadConfig } from '../../config/config.js';
import { BybitClient } from '../bybit/bybit.client.js';
import { mapBybitInstrument } from '../bybit/bybit.mapper.js';
import { BybitKlineBackfill } from './kline-backfill.js';
import { loadHistoricalDataset } from './dataset-cache.js';
import { HistoricalEvaluator, DEFAULT_HORIZON_HOURS, floorToHour } from './historical-evaluator.js';
import { buildReport, renderMarkdown } from './backtest-report.js';

/**
 * Read-only CLI: public market-data GETs only. Places no orders and touches no account.
 *
 *   tsx src/modules/backtest/run-backtest.ts [--days 90] [--cutoff ISO] [--step-hours 6]
 *     [--horizons 24,72,168] [--quote USDC] [--symbols A,B] [--cache-dir dir] [--out-dir dir]
 *     [--offline] [--write-observations]
 */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main(): Promise<void> {
  const config = loadConfig();
  const days = Number(arg('days') ?? 90);
  const stepHours = Number(arg('step-hours') ?? 6);
  const horizons = (arg('horizons') ?? DEFAULT_HORIZON_HOURS.join(',')).split(',').map(Number);
  const quoteCoin = (arg('quote') ?? 'USDC').toUpperCase();
  const cutoffMs = arg('cutoff') ? Date.parse(arg('cutoff') as string) : floorToHour(Date.now());
  if (!Number.isFinite(cutoffMs) || !Number.isFinite(days) || horizons.some((h) => !Number.isInteger(h) || h < 1)) {
    throw new Error('Invalid --cutoff, --days or --horizons');
  }
  const startMs = floorToHour(cutoffMs - days * 24 * 3_600_000);
  const cacheDir = resolve(arg('cache-dir') ?? 'data/backtest');
  const outDir = resolve(arg('out-dir') ?? join('data/backtest/reports', `${quoteCoin}_${new Date(cutoffMs).toISOString().slice(0, 13)}`));

  const log = (m: string) => console.log(m);
  log(`baseUrl=${config.bybitBaseUrl} quote=${quoteCoin} start=${new Date(startMs).toISOString()} cutoff=${new Date(cutoffMs).toISOString()}`);

  const instruments = (await new BybitClient(config).getSpotInstruments()).map(mapBybitInstrument);
  const backfill = flag('offline') ? null : new BybitKlineBackfill({ baseUrl: config.bybitBaseUrl });
  const symbols = arg('symbols')?.split(',').map((s) => s.trim().toUpperCase());

  const dataset = await loadHistoricalDataset({
    quoteCoin,
    instruments,
    startMs,
    cutoffMs,
    cacheDir,
    backfill,
    ...(symbols ? { symbols } : {}),
    onProgress: log
  });

  const evaluator = new HistoricalEvaluator(dataset, config);
  const observations = await evaluator.evaluate({ stepHours, horizonHours: horizons, onProgress: log });
  const timestamps = new Set(observations.map((o) => o.asOfMs));
  const report = buildReport({
    dataset,
    observations,
    horizonHours: horizons,
    stepHours,
    firstEvalMs: evaluator.defaultFirstEvalMs(),
    lastEvalMs: evaluator.defaultLastEvalMs(),
    evaluationTimestamps: timestamps.size
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  await writeFile(join(outDir, 'report.md'), renderMarkdown(report));
  if (flag('write-observations')) {
    await writeFile(join(outDir, 'observations.ndjson'), observations.map((o) => JSON.stringify(o)).join('\n'));
  }
  log(`wrote ${outDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
