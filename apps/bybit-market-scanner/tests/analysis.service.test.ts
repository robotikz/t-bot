import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisService } from '../src/modules/analysis/analysis.service.js';
import { loadConfig } from '../src/config/config.js';

function makeTinyCandles(offset = 0) {
  const pattern = [
    { open: 0.0000041 + offset, high: 0.00000418 + offset, low: 0.000004 + offset, close: 0.00000412 + offset },
    { open: 0.00000412 + offset, high: 0.0000043 + offset, low: 0.00000402 + offset, close: 0.00000425 + offset },
    { open: 0.00000405 + offset, high: 0.00000422 + offset, low: 0.00000399 + offset, close: 0.00000405 + offset },
    { open: 0.0000042 + offset, high: 0.00000432 + offset, low: 0.00000401 + offset, close: 0.0000042 + offset },
    { open: 0.00000415 + offset, high: 0.00000435 + offset, low: 0.00000403 + offset, close: 0.0000043 + offset },
    { open: 0.00000418 + offset, high: 0.00000431 + offset, low: 0.00000407 + offset, close: 0.00000415 + offset }
  ];

  return Array.from({ length: 120 }, (_, index) => ({
    timestamp: Date.now() - (120 - index) * 60_000,
    ...pattern[index % pattern.length],
    volume: 1,
    turnover: 1,
    isClosed: true
  }));
}

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

  it('preserves PEPE-like precision through analysis output', async () => {
    const cfg = loadConfig();
    const service = new AnalysisService(marketService, cfg);

    vi.mocked(marketService.getMarketTicker).mockResolvedValue({
      symbol: 'PEPEUSDC',
      lastPrice: 0.000004095,
      change24hPercent: 1.23,
      volume24h: 10_000,
      turnover24h: 25_000
    });

    vi.mocked(marketService.getCandles).mockImplementation(async (_symbol: string, timeframe: '1h' | '15m') =>
      timeframe === '1h' ? makeTinyCandles(0) : makeTinyCandles(0.00000035)
    );

    const result1h = await service.analyzeSymbol('PEPEUSDC', '1h', { minTurnover: 1000 });
    const result15m = await service.analyzeSymbol('PEPEUSDC', '15m', { minTurnover: 1000 });

    expect(result1h.price).toBe(0.000004095);
    expect(result1h.support).toBeGreaterThan(0);
    expect(result1h.resistance).toBeGreaterThan(result1h.support);
    expect(result15m.support).not.toBe(result1h.support);
    expect(result15m.resistance).not.toBe(result1h.resistance);
  });
});
