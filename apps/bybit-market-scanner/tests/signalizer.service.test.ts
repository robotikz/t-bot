import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config/config.js';
import { SignalizerService } from '../src/modules/signalizer/signalizer.service.js';
import { InMemorySignalStateStore } from '../src/modules/signalizer/state/signal-state.store.js';
import type { MarketService } from '../src/modules/market/market.service.js';
import type { ScannerService } from '../src/modules/scanner/scanner.service.js';
import type { ScannerCandidate } from '../src/modules/scanner/scanner.types.js';

function makeCandidate(
  symbol: string,
  overrides: Partial<ScannerCandidate> = {}
): ScannerCandidate {
  return {
    symbol,
    score: 78,
    status: 'CANDIDATE',
    market: {
      symbol,
      lastPrice: 100,
      change24hPercent: 1.2,
      high24h: 103,
      low24h: 96,
      volume24h: 100_000,
      turnover24h: 2_000_000,
      timestamp: Date.now()
    },
    analysis15m: {
      symbol,
      price: 100,
      change24hPercent: 1.2,
      volume24h: 100_000,
      turnover24h: 2_000_000,
      timeframe: '15m',
      rangeHigh: 104,
      rangeLow: 95,
      rangePercent: 9,
      support: 97,
      resistance: 103,
      distanceToSupportPercent: 2,
      distanceToResistancePercent: 2.5,
      positionInRangePercent: 45,
      volatilityPercent: 1,
      trendDirection: 'UP',
      trendStrength: 1,
      liquidityScore: 80,
      gridScore: 80,
      rejectionReasons: []
    },
    analysis1h: {
      symbol,
      price: 100,
      change24hPercent: 1.2,
      volume24h: 100_000,
      turnover24h: 2_000_000,
      timeframe: '1h',
      rangeHigh: 104,
      rangeLow: 95,
      rangePercent: 9,
      support: 97,
      resistance: 103,
      distanceToSupportPercent: 2,
      distanceToResistancePercent: 2.5,
      positionInRangePercent: 45,
      volatilityPercent: 1,
      trendDirection: 'UP',
      trendStrength: 1,
      liquidityScore: 80,
      gridScore: 80,
      rejectionReasons: []
    },
    reasons: ['PASSES_FILTERS'],
    rejectionReasons: [],
    entryTiming: 'READY',
    entryScore: 80,
    entryReasons: ['Pullback reached support and price is stabilizing.'],
    recommendedEntryZone: {
      supportBasedEntry: { min: 97, max: 98 },
      breakoutRetestEntry: { min: 102, max: 103 }
    },
    ...overrides
  };
}

describe('signalizer.service', () => {
  const marketService = {
    getMarketsByQuoteCoin: vi.fn(),
    getCandles: vi.fn()
  } as unknown as MarketService;

  const scannerService = {
    scan: vi.fn()
  } as unknown as ScannerService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps USDT analysis to USDC bot pair and tracks state changes', async () => {
    const store = new InMemorySignalStateStore();
    const service = new SignalizerService(marketService, scannerService, store, loadConfig());

    vi.mocked(marketService.getMarketsByQuoteCoin).mockResolvedValue([
      { symbol: 'SOLUSDC', baseCoin: 'SOL', quoteCoin: 'USDC', status: 'Trading' }
    ]);

    const closes = [
      ...Array.from({ length: 102 }, () => 100),
      99.2,
      98.9,
      98.4,
      98,
      97.8,
      97.6,
      97.5,
      97.4,
      97.35,
      97.3,
      97.35,
      97.4,
      97.45,
      97.5,
      97.55,
      97.6,
      97.65
    ];

    vi.mocked(marketService.getCandles).mockResolvedValue(
      closes.map((close, index) => ({
        timestamp: Date.now() - (closes.length - index) * 15 * 60_000,
        open: close,
        high: close * 1.002,
        low: close * 0.998,
        close,
        volume: 1_000,
        turnover: 100_000,
        isClosed: true
      }))
    );

    vi.mocked(scannerService.scan)
      .mockResolvedValueOnce({
        timestamp: '2026-10-07T10:00:00.000Z',
        count: 1,
        candidates: [makeCandidate('SOLUSDT')]
      })
      .mockResolvedValueOnce({
        timestamp: '2026-10-07T10:15:00.000Z',
        count: 1,
        candidates: [
          makeCandidate('SOLUSDT', {
            status: 'REJECTED',
            entryTiming: 'NO_ENTRY',
            rejectionReasons: ['STRONG_DOWNTREND']
          })
        ]
      });

    const first = await service.scan();
    const firstSignal = first.signals[0];

    expect(firstSignal?.pairAnalyzed).toBe('SOLUSDT');
    expect(firstSignal?.targetBotPair).toBe('SOLUSDC');
    expect(firstSignal?.usdcAvailable).toBe(true);
    expect(firstSignal?.state).toBe('READY');
    expect(firstSignal?.stateChanged).toBe(false);

    const second = await service.scan();
    const secondSignal = second.signals[0];

    expect(secondSignal?.state).toBe('INVALIDATED');
    expect(secondSignal?.previousState).toBe('READY');
    expect(secondSignal?.stateChanged).toBe(true);
  });

  it('skips overlapping scans', async () => {
    const store = new InMemorySignalStateStore();
    const service = new SignalizerService(marketService, scannerService, store, loadConfig());

    vi.mocked(marketService.getMarketsByQuoteCoin).mockResolvedValue([]);

    let release = () => {};
    const pending = new Promise<{ timestamp: string; count: number; candidates: ScannerCandidate[] }>(
      (resolve) => {
        release = () => resolve({ timestamp: '2026-10-07T10:00:00.000Z', count: 0, candidates: [] });
      }
    );

    vi.mocked(scannerService.scan).mockReturnValueOnce(pending as ReturnType<ScannerService['scan']>);

    const firstScanPromise = service.scan();
    const skipped = await service.scan();

    expect(skipped.skipped).toBe(true);
    expect(skipped.isRunning).toBe(true);

    release();
    const firstScan = await firstScanPromise;
    expect(firstScan.skipped).toBe(false);
  });
});
