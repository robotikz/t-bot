import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScannerService } from '../src/modules/scanner/scanner.service.js';
import type { AnalysisService } from '../src/modules/analysis/analysis.service.js';
import type { MarketService } from '../src/modules/market/market.service.js';
import { loadConfig } from '../src/config/config.js';
import { ExternalServiceError, ValidationError } from '../src/shared/errors/app-error.js';

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
    expect(result.candidates[1]?.status).toBe('REJECTED');
  });

  it('never ranks a hard-failed symbol above an eligible one, even with a higher score', async () => {
    const config = { ...loadConfig(), topCandidates: 10 };
    const service = new ScannerService(marketService, analysisService, config);
    const mk = (symbol: string) => ({ symbol, baseCoin: symbol, quoteCoin: 'USDC', status: 'Trading' });
    const tk = (symbol: string) => ({
      symbol, lastPrice: 100, change24hPercent: 0, high24h: 101, low24h: 99,
      volume24h: 1, turnover24h: 2_000_000, timestamp: Date.now()
    });
    vi.mocked(marketService.getMarketsByQuoteCoin).mockResolvedValue([mk('AAAUSDC'), mk('BBBUSDC')] as any);
    vi.mocked(marketService.getTickers).mockResolvedValue([tk('AAAUSDC'), tk('BBBUSDC')] as any);
    vi.mocked(marketService.getCandles).mockResolvedValue([]);
    vi.mocked(analysisService.analyzeSymbol).mockImplementation(async (symbol: string) =>
      symbol === 'AAAUSDC'
        ? makeAnalysis({ symbol, gridScore: 99, rejectionReasons: ['INSUFFICIENT_CANDLES'] })
        : makeAnalysis({ symbol, gridScore: 65 })
    );

    const result = await service.scan();

    expect(result.candidates.map((c) => c.symbol)).toEqual(['BBBUSDC', 'AAAUSDC']);
    expect(result.candidates[0]?.status).toBe('CANDIDATE');
    expect(result.candidates[1]?.status).toBe('REJECTED');
  });

  it('forces REJECTED for LOW_LIQUIDITY and topLimit keeps eligible candidates over higher-scored rejects', async () => {
    const config = { ...loadConfig(), topCandidates: 1 };
    const service = new ScannerService(marketService, analysisService, config);
    const mk = (symbol: string) => ({ symbol, baseCoin: symbol, quoteCoin: 'USDC', status: 'Trading' });
    const tk = (symbol: string) => ({
      symbol, lastPrice: 100, change24hPercent: 0, high24h: 101, low24h: 99,
      volume24h: 1, turnover24h: 2_000_000, timestamp: Date.now()
    });
    vi.mocked(marketService.getMarketsByQuoteCoin).mockResolvedValue(
      [mk('AAAUSDC'), mk('BBBUSDC'), mk('CCCUSDC')] as any
    );
    vi.mocked(marketService.getTickers).mockResolvedValue([tk('AAAUSDC'), tk('BBBUSDC'), tk('CCCUSDC')] as any);
    vi.mocked(marketService.getCandles).mockResolvedValue([]);
    vi.mocked(analysisService.analyzeSymbol).mockImplementation(async (symbol: string) => {
      if (symbol === 'AAAUSDC') return makeAnalysis({ symbol, gridScore: 100, rejectionReasons: ['LOW_LIQUIDITY'] });
      if (symbol === 'BBBUSDC') return makeAnalysis({ symbol, gridScore: 90, rejectionReasons: ['RANGE_OUT_OF_BOUNDS'] });
      return makeAnalysis({ symbol, gridScore: 50 });
    });

    const result = await service.scan({ limit: 1 });
    expect(result.candidates.map((x) => x.symbol)).toEqual(['CCCUSDC']);
    expect(result.candidates[0]?.status).toBe('CANDIDATE');

    const all = await service.scan({ limit: 10 });
    expect(all.candidates.map((x) => [x.symbol, x.status])).toEqual([
      ['CCCUSDC', 'CANDIDATE'],
      ['BBBUSDC', 'WATCH'],
      ['AAAUSDC', 'REJECTED']
    ]);
  });

  it('forces REJECTED for STRONG_DOWNTREND regardless of score', async () => {
    const config = { ...loadConfig(), topCandidates: 10 };
    const service = new ScannerService(marketService, analysisService, config);
    const mk = (symbol: string) => ({ symbol, baseCoin: symbol, quoteCoin: 'USDC', status: 'Trading' });
    const tk = (symbol: string) => ({
      symbol, lastPrice: 100, change24hPercent: 0, high24h: 101, low24h: 99,
      volume24h: 1, turnover24h: 2_000_000, timestamp: Date.now()
    });
    vi.mocked(marketService.getMarketsByQuoteCoin).mockResolvedValue([mk('AAAUSDC')] as any);
    vi.mocked(marketService.getTickers).mockResolvedValue([tk('AAAUSDC')] as any);
    vi.mocked(marketService.getCandles).mockResolvedValue([]);
    vi.mocked(analysisService.analyzeSymbol).mockResolvedValue(
      makeAnalysis({ symbol: 'AAAUSDC', gridScore: 95, rejectionReasons: ['STRONG_DOWNTREND'] })
    );

    const result = await service.scan();
    expect(result.candidates[0]?.status).toBe('REJECTED');
  });

  describe('per-symbol error isolation', () => {
    const setup = () => {
      const config = { ...loadConfig(), topCandidates: 10 };
      const service = new ScannerService(marketService, analysisService, config);
      const mk = (symbol: string) => ({ symbol, baseCoin: symbol, quoteCoin: 'USDC', status: 'Trading' });
      const tk = (symbol: string) => ({
        symbol, lastPrice: 100, change24hPercent: 0, high24h: 101, low24h: 99,
        volume24h: 1, turnover24h: 2_000_000, timestamp: Date.now()
      });
      vi.mocked(marketService.getMarketsByQuoteCoin).mockResolvedValue([mk('BADUSDC'), mk('GOODUSDC')] as any);
      vi.mocked(marketService.getTickers).mockResolvedValue([tk('BADUSDC'), tk('GOODUSDC')] as any);
      vi.mocked(marketService.getCandles).mockResolvedValue([]);
      return service;
    };

    it('records a malformed-data symbol as unresolved and still returns valid candidates', async () => {
      const service = setup();
      vi.mocked(analysisService.analyzeSymbol).mockImplementation(async (symbol: string) => {
        if (symbol === 'BADUSDC') {
          throw new ValidationError('MALFORMED_CANDLE', 'Non-finite open/high/low value');
        }
        return makeAnalysis({ symbol, gridScore: 80 });
      });

      const result = await service.scan();

      expect(result.candidates.map((c) => c.symbol)).toEqual(['GOODUSDC']);
      expect(result.candidates[0]?.status).toBe('CANDIDATE');
      expect(result.unresolvedSymbols).toEqual([
        expect.objectContaining({ symbol: 'BADUSDC', reasonCode: 'INVALID_MARKET_DATA' })
      ]);
      expect(result.unresolvedSymbols?.[0]?.detail).toContain('MALFORMED_CANDLE');
    });

    it('propagates systemic external-service errors instead of swallowing them', async () => {
      const service = setup();
      vi.mocked(analysisService.analyzeSymbol).mockRejectedValue(
        new ExternalServiceError('Bybit rate limit exceeded', 'RATE_LIMIT', 429)
      );

      await expect(service.scan()).rejects.toThrow('Bybit rate limit exceeded');
    });

    it('propagates unexpected non-validation errors', async () => {
      const service = setup();
      vi.mocked(analysisService.analyzeSymbol).mockRejectedValue(new TypeError('boom'));

      await expect(service.scan()).rejects.toThrow('boom');
    });
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

  it('reports instruments with no matching ticker as unresolved and never turns them into a candidate', async () => {
    const config = { ...loadConfig(), topCandidates: 5 };
    const service = new ScannerService(marketService, analysisService, config);

    // ZKUSDC is a valid, Trading instrument but Bybit's ticker feed does not
    // return it in this scenario (e.g. transient feed gap). It must be
    // reported explicitly, not silently dropped, and must never become a
    // CANDIDATE/WATCH/READY result.
    vi.mocked(marketService.getMarketsByQuoteCoin).mockResolvedValue([
      { symbol: 'ASTERUSDC', baseCoin: 'ASTER', quoteCoin: 'USDC', status: 'Trading' },
      { symbol: 'ZKUSDC', baseCoin: 'ZK', quoteCoin: 'USDC', status: 'Trading' }
    ]);

    vi.mocked(marketService.getTickers).mockResolvedValue([
      {
        symbol: 'ASTERUSDC',
        lastPrice: 0.71,
        change24hPercent: 0.1,
        high24h: 0.72,
        low24h: 0.7,
        volume24h: 10_000,
        turnover24h: 2_000_000,
        timestamp: Date.now()
      }
    ]);

    vi.mocked(marketService.getCandles).mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({
        timestamp: Date.now() - (20 - index) * 60_000,
        open: 0.7,
        high: 0.71,
        low: 0.69,
        close: 0.7,
        volume: 1_000,
        turnover: 100_000,
        isClosed: true
      }))
    );

    vi.mocked(analysisService.analyzeSymbol)
      .mockResolvedValueOnce(makeAnalysis({ symbol: 'ASTERUSDC', timeframe: '1h', gridScore: 85 }))
      .mockResolvedValueOnce(makeAnalysis({ symbol: 'ASTERUSDC', timeframe: '15m', gridScore: 85 }));

    const result = await service.scan({ quoteCoin: 'USDC' });

    expect(result.candidates.some((candidate) => candidate.symbol === 'ZKUSDC')).toBe(false);
    expect(result.unresolvedSymbols).toEqual([{ symbol: 'ZKUSDC', reasonCode: 'MISSING_TICKER' }]);
    expect(result.candidates[0]?.symbol).toBe('ASTERUSDC');
  });
});
