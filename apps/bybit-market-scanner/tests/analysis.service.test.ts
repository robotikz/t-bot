import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisService } from '../src/modules/analysis/analysis.service.js';
import { loadConfig } from '../src/config/config.js';

function makeCandles() {
  return Array.from({ length: 120 }, (_, index) => ({
    timestamp: Date.now() - (120 - index) * 60_000,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
    turnover: 1,
    isClosed: true
  }));
}

describe('AnalysisService liquidity threshold', () => {
  const marketService = {
    getMarketTicker: vi.fn(),
    getCandles: vi.fn()
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(marketService.getCandles).mockResolvedValue(makeCandles());
  });

  it('rejects when turnover < provided minTurnover', async () => {
    const cfg = loadConfig();
    const service = new AnalysisService(marketService, cfg);

    vi.mocked(marketService.getMarketTicker).mockResolvedValue({
      symbol: 'FOOUSDC',
      lastPrice: 1,
      change24hPercent: 0,
      volume24h: 1,
      turnover24h: 9_999
    });

    const result = await service.analyzeSymbol('FOOUSDC', '1h', { minTurnover: 10000 });
    expect(result.rejectionReasons).toContain('LOW_LIQUIDITY');
  });

  it('accepts when turnover == provided minTurnover', async () => {
    const cfg = loadConfig();
    const service = new AnalysisService(marketService, cfg);

    vi.mocked(marketService.getMarketTicker).mockResolvedValue({
      symbol: 'FOOUSDC',
      lastPrice: 1,
      change24hPercent: 0,
      volume24h: 1,
      turnover24h: 10000
    });

    const result = await service.analyzeSymbol('FOOUSDC', '1h', { minTurnover: 10000 });
    expect(result.rejectionReasons).not.toContain('LOW_LIQUIDITY');
  });

  it('accepts when turnover > provided minTurnover', async () => {
    const cfg = loadConfig();
    const service = new AnalysisService(marketService, cfg);

    vi.mocked(marketService.getMarketTicker).mockResolvedValue({
      symbol: 'FOOUSDC',
      lastPrice: 1,
      change24hPercent: 0,
      volume24h: 1,
      turnover24h: 10001
    });

    const result = await service.analyzeSymbol('FOOUSDC', '1h', { minTurnover: 10000 });
    expect(result.rejectionReasons).not.toContain('LOW_LIQUIDITY');
  });
});
