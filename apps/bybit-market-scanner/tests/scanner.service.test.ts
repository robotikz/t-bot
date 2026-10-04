import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScannerService } from '../src/modules/scanner/scanner.service.js';
import type { AnalysisService } from '../src/modules/analysis/analysis.service.js';
import type { MarketService } from '../src/modules/market/market.service.js';
import { loadConfig } from '../src/config/config.js';

describe('scanner.service', () => {
  const marketService = {
    getUSDCMarkets: vi.fn(),
    getTickers: vi.fn()
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

    vi.mocked(marketService.getUSDCMarkets).mockResolvedValue([
      { symbol: 'BTCUSDC', baseCoin: 'BTC', quoteCoin: 'USDC', status: 'Trading' },
      { symbol: 'ETHUSDC', baseCoin: 'ETH', quoteCoin: 'USDC', status: 'Trading' }
    ]);

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
      .mockResolvedValueOnce({ symbol: 'BTCUSDC', gridScore: 90, rejectionReasons: [] } as any)
      .mockResolvedValueOnce({ symbol: 'BTCUSDC', gridScore: 80, rejectionReasons: [] } as any)
      .mockResolvedValueOnce({ symbol: 'ETHUSDC', gridScore: 70, rejectionReasons: ['LOW_LIQUIDITY'] } as any)
      .mockResolvedValueOnce({ symbol: 'ETHUSDC', gridScore: 60, rejectionReasons: ['LOW_LIQUIDITY'] } as any);

    const result = await service.scan();

    expect(result.count).toBe(2);
    expect(result.candidates[0]?.symbol).toBe('BTCUSDC');
    expect(result.candidates[0]?.status).toBe('CANDIDATE');
    expect(result.candidates[1]?.status).toBe('WATCH');
  });
});
