import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScannerService } from '../src/modules/scanner/scanner.service.js';
import type { AnalysisService } from '../src/modules/analysis/analysis.service.js';
import type { MarketService } from '../src/modules/market/market.service.js';
import { loadConfig } from '../src/config/config.js';

function makeAnalysis(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    symbol: 'BTCUSDC',
    price: 100,
    change24hPercent: 1,
    volume24h: 100_000,
    turnover24h: 2_000_000,
    timeframe: '1h',
    rangeHigh: 110,
    rangeLow: 90,
    rangePercent: 22,
    support: 95,
    resistance: 105,
    distanceToSupportPercent: 2,
    distanceToResistancePercent: 4,
    positionInRangePercent: 40,
    volatilityPercent: 1,
    trendDirection: 'UP',
    trendStrength: 1,
    liquidityScore: 80,
    gridScore: 80,
    rejectionReasons: [],
    ...overrides
  } as any;
}

describe('scanner.service', () => {
  const marketService = {
    getUSDCMarkets: vi.fn(),
    getMarketsByQuoteCoin: vi.fn(),
    getTickers: vi.fn(),
    getCandles: vi.fn()
  } as unknown as MarketService;

  const analysisService = {
    analyzeSymbol: vi.fn()
  } as unknown as AnalysisService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds candidates sorted by score', async () => {
    const config = { ...loadConfig(), topCandidates: 10 };
    const service = new ScannerService(marketService, analysisService, config);

    vi.mocked(marketService.getMarketsByQuoteCoin).mockResolvedValue([
      { symbol: 'BTCUSDC', baseCoin: 'BTC', quoteCoin: 'USDC', status: 'Trading' },
      { symbol: 'ETHUSDC', baseCoin: 'ETH', quoteCoin: 'USDC', status: 'Trading' }
    ]);

    vi.mocked(marketService.getCandles).mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({
        timestamp: Date.now() - (20 - index) * 60_000,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1_000,
        turnover: 100_000,
        isClosed: true
      }))
    );

    vi.mocked(marketService.getTickers).mockResolvedValue([
      {
        symbol: 'BTCUSDC',
        lastPrice: 100,
        change24hPercent: 1,
        high24h: 110,
        low24h: 90,
        volume24h: 100,
        turnover24h: 2_000_000,
        timestamp: Date.now()
      },
      {
        symbol: 'ETHUSDC',
        lastPrice: 50,
        change24hPercent: 0.5,
        high24h: 52,
        low24h: 45,
        volume24h: 100,
        turnover24h: 1_500_000,
        timestamp: Date.now()
      }
    ]);

    vi.mocked(analysisService.analyzeSymbol)
      .mockResolvedValueOnce(makeAnalysis({ symbol: 'BTCUSDC', timeframe: '1h', gridScore: 90 }))
      .mockResolvedValueOnce(makeAnalysis({ symbol: 'BTCUSDC', timeframe: '15m', gridScore: 80 }))
      .mockResolvedValueOnce(
        makeAnalysis({
          symbol: 'ETHUSDC',
          timeframe: '1h',
          gridScore: 70,
          rejectionReasons: ['LOW_LIQUIDITY']
        })
      )
      .mockResolvedValueOnce(
        makeAnalysis({
          symbol: 'ETHUSDC',
          timeframe: '15m',
          gridScore: 60,
          rejectionReasons: ['LOW_LIQUIDITY']
        })
      );

    const result = await service.scan();

    expect(result.count).toBe(2);
    expect(result.candidates[0]?.symbol).toBe('BTCUSDC');
    expect(result.candidates[0]?.status).toBe('CANDIDATE');
    expect(result.candidates[1]?.status).toBe('WATCH');
  });

  it('keeps CANDIDATE status while entry timing waits for pullback at range high', async () => {
    const config = { ...loadConfig(), topCandidates: 5 };
    const service = new ScannerService(marketService, analysisService, config);

    vi.mocked(marketService.getMarketsByQuoteCoin).mockResolvedValue([
      { symbol: 'ADAUSDC', baseCoin: 'ADA', quoteCoin: 'USDC', status: 'Trading' }
    ]);

    vi.mocked(marketService.getTickers).mockResolvedValue([
      {
        symbol: 'ADAUSDC',
        lastPrice: 0.274,
        change24hPercent: 11,
        high24h: 0.278,
        low24h: 0.245,
        volume24h: 800_000,
        turnover24h: 2_500_000,
        timestamp: Date.now()
      }
    ]);

    vi.mocked(marketService.getCandles).mockResolvedValue(
      Array.from({ length: 22 }, (_, index) => ({
        timestamp: Date.now() - (22 - index) * 15 * 60_000,
        open: 0.25 + index * 0.001,
        high: 0.251 + index * 0.001,
        low: 0.249 + index * 0.001,
        close: 0.25 + index * 0.001,
        volume: 10_000,
        turnover: 2_500,
        isClosed: true
      }))
    );

    vi.mocked(analysisService.analyzeSymbol)
      .mockResolvedValueOnce(
        makeAnalysis({
          symbol: 'ADAUSDC',
          timeframe: '1h',
          gridScore: 65,
          change24hPercent: 11,
          trendDirection: 'UP',
          positionInRangePercent: 92,
          distanceToResistancePercent: 0.8,
          distanceToSupportPercent: 6,
          support: 0.26,
          resistance: 0.275
        })
      )
      .mockResolvedValueOnce(
        makeAnalysis({
          symbol: 'ADAUSDC',
          timeframe: '15m',
          gridScore: 53,
          change24hPercent: 11,
          trendDirection: 'UP',
          positionInRangePercent: 92,
          distanceToResistancePercent: 0.8,
          distanceToSupportPercent: 6,
          support: 0.26,
          resistance: 0.275
        })
      );

    const result = await service.scan();
    const candidate = result.candidates[0];

    expect(candidate?.status).toBe('CANDIDATE');
    expect(candidate?.entryTiming).toBe('WAIT_PULLBACK');
  });
});
