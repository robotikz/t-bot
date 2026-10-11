import type { AppConfig } from '../../config/config.js';
import { mapWithConcurrency } from '../../shared/utils/promise-pool.js';
import type { AnalysisService } from '../analysis/analysis.service.js';
import type { ScannerCandidate, ScanResult } from './scanner.types.js';
import type { MarketService } from '../market/market.service.js';
import type { Timeframe } from '../market/market.types.js';
import { EntryTimingService } from './domain/entry-timing/entry-timing.service.js';

type LegacyMarketService = {
  getUSDTMarkets?: () => ReturnType<MarketService['getMarketsByQuoteCoin']>;
  getUSDCMarkets?: () => ReturnType<MarketService['getMarketsByQuoteCoin']>;
};

function buildPositiveReasons(score: number, rejectionReasons: string[]): string[] {
  const reasons: string[] = [];
  if (score >= 80) reasons.push('HIGH_SCORE');
  if (score >= 60 && score < 80) reasons.push('MODERATE_SCORE');
  if (rejectionReasons.length === 0) reasons.push('PASSES_FILTERS');
  return reasons;
}

function resolveStatus(score: number, rejectionReasons: string[]): ScannerCandidate['status'] {
  if (rejectionReasons.length === 0) return 'CANDIDATE';
  if (score >= 60) return 'WATCH';
  return 'REJECTED';
}

export class ScannerService {
  private readonly entryTimingService: EntryTimingService;

  constructor(
    private readonly marketService: MarketService,
    private readonly analysisService: AnalysisService,
    private readonly config: AppConfig
  ) {
    this.entryTimingService = new EntryTimingService(config);
  }

  async scan(options?: {
    quoteCoin?: string;
    timeframe?: Timeframe;
    secondaryTimeframe?: Timeframe;
    limit?: number;
    minTurnover?: number;
  }): Promise<ScanResult> {
    const quoteCoin = (options?.quoteCoin ?? 'USDT').trim().toUpperCase();
    const primaryTimeframe = options?.timeframe ?? '1h';
    const secondaryTimeframe = options?.secondaryTimeframe ?? '15m';
    const topLimit = Math.max(1, Math.floor(options?.limit ?? this.config.topCandidates));
    const minTurnover = options?.minTurnover ?? this.config.minTurnover24hUsdt;

    const marketService = this.marketService as MarketService & LegacyMarketService;
    const marketsPromise =
      typeof marketService.getMarketsByQuoteCoin === 'function'
        ? marketService.getMarketsByQuoteCoin(quoteCoin)
        : quoteCoin === 'USDT' && typeof marketService.getUSDTMarkets === 'function'
          ? marketService.getUSDTMarkets()
          : quoteCoin === 'USDC' && typeof marketService.getUSDCMarkets === 'function'
          ? marketService.getUSDCMarkets()
          : Promise.reject(
              new Error(
                'Market service is missing getMarketsByQuoteCoin(quoteCoin) and legacy quote-coin helpers'
              )
            );

    const [markets, tickers] = await Promise.all([
      marketsPromise,
      this.marketService.getTickers()
    ]);

    const tickerBySymbol = new Map(tickers.map((ticker) => [ticker.symbol, ticker]));

    // Instruments returned by instruments-info that have no matching ticker
    // are explicitly unresolved (e.g. delisting in progress, symbol mismatch,
    // or a malformed ticker payload that was dropped during mapping). They
    // must be reported with an explicit reason code and must never silently
    // become a CANDIDATE/WATCH/READY result.
    const unresolvedSymbols: { symbol: string; reasonCode: 'MISSING_TICKER' }[] = [];
    const symbols = markets
      .map((market) => market.symbol)
      .filter((symbol) => {
        if (tickerBySymbol.has(symbol)) return true;
        unresolvedSymbols.push({ symbol, reasonCode: 'MISSING_TICKER' });
        return false;
      })
      .filter((symbol) => {
        const ticker = tickerBySymbol.get(symbol);
        return Boolean(ticker && ticker.turnover24h >= minTurnover);
      });

    const candidates = await mapWithConcurrency(
      symbols,
      this.config.maxConcurrentCandleRequests,
      async (symbol) => {
        const market = tickerBySymbol.get(symbol);
        if (!market) {
          throw new Error(`Ticker missing for symbol ${symbol}`);
        }

        const [primaryAnalysis, secondaryAnalysis, candles15m] = await Promise.all([
          this.analysisService.analyzeSymbol(symbol, primaryTimeframe, { minTurnover }),
          this.analysisService.analyzeSymbol(symbol, secondaryTimeframe, { minTurnover }),
          this.marketService.getCandles(symbol, '15m', 80)
        ]);

        const analysisByTimeframe = new Map<Timeframe, typeof primaryAnalysis>([
          [primaryTimeframe, primaryAnalysis],
          [secondaryTimeframe, secondaryAnalysis]
        ]);

        const analysis1h =
          analysisByTimeframe.get('1h') ?? (await this.analysisService.analyzeSymbol(symbol, '1h', { minTurnover }));
        const analysis15m =
          analysisByTimeframe.get('15m') ?? (await this.analysisService.analyzeSymbol(symbol, '15m', { minTurnover }));

        const score = primaryAnalysis.gridScore * 0.7 + secondaryAnalysis.gridScore * 0.3;
        const rejectionReasons = Array.from(
          new Set([...primaryAnalysis.rejectionReasons, ...secondaryAnalysis.rejectionReasons])
        );

        const entryTiming = this.entryTimingService.evaluate({
          analysis1h,
          analysis15m,
          candles15m
        });

        return {
          symbol,
          score,
          status: resolveStatus(score, rejectionReasons),
          market,
          analysis15m,
          analysis1h,
          reasons: buildPositiveReasons(score, rejectionReasons),
          rejectionReasons,
          ...entryTiming
        } satisfies ScannerCandidate;
      }
    );

    const sorted = [...candidates]
      .sort((a, b) => b.score - a.score)
      .slice(0, topLimit)
      .map((item) => ({ ...item, score: Number(item.score.toFixed(4)) }));

    return {
      timestamp: new Date().toISOString(),
      count: sorted.length,
      candidates: sorted,
      ...(unresolvedSymbols.length > 0 ? { unresolvedSymbols } : {})
    };
  }
}
