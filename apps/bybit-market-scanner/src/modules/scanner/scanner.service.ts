import type { AppConfig } from '../../config/config.js';
import { mapWithConcurrency } from '../../shared/utils/promise-pool.js';
import { ValidationError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/utils/logger.js';
import type { AnalysisService } from '../analysis/analysis.service.js';
import type { ScannerCandidate, ScanResult, UnresolvedInstrument } from './scanner.types.js';
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

// Mandatory failures can never be offset by a high score. STRONG_DOWNTREND is a
// combined 24h-drop + DOWN trend + window-drop condition and is stricter than the
// 1h-DOWN condition the signalizer already maps to NO_TRADE. Range, volatility and
// TREND_TOO_STRONG stay soft: they are already penalised by the score components.
const HARD_REJECTION_REASONS = new Set(['LOW_LIQUIDITY', 'INSUFFICIENT_CANDLES', 'STRONG_DOWNTREND']);

// Per-symbol data problems that must not abort the whole scan. Anything else
// (HTTP/rate-limit/timeout ExternalServiceError, programming errors) still fails the scan.
const ISOLATED_SYMBOL_ERROR_CODES = new Set([
  'MALFORMED_CANDLE',
  'MALFORMED_BYBIT_KLINE',
  'MALFORMED_BYBIT_TICKER',
  'INSUFFICIENT_CANDLES',
  'INVALID_SYMBOL'
]);

const STATUS_RANK: Record<ScannerCandidate['status'], number> = {
  CANDIDATE: 0,
  WATCH: 1,
  REJECTED: 2
};

function resolveStatus(score: number, rejectionReasons: string[]): ScannerCandidate['status'] {
  if (rejectionReasons.some((reason) => HARD_REJECTION_REASONS.has(reason))) return 'REJECTED';
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
    const unresolvedSymbols: UnresolvedInstrument[] = [];
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

    const results = await mapWithConcurrency(
      symbols,
      this.config.maxConcurrentCandleRequests,
      async (symbol): Promise<ScannerCandidate | null> => {
        try {
          return await this.analyzeCandidate(symbol, tickerBySymbol, {
            primaryTimeframe,
            secondaryTimeframe,
            minTurnover
          });
        } catch (error) {
          if (error instanceof ValidationError && ISOLATED_SYMBOL_ERROR_CODES.has(error.code)) {
            logger.warn('scanner symbol skipped due to invalid market data', {
              symbol,
              code: error.code,
              message: error.message
            });
            unresolvedSymbols.push({
              symbol,
              reasonCode: 'INVALID_MARKET_DATA',
              detail: `${error.code}: ${error.message}`
            });
            return null;
          }
          throw error;
        }
      }
    );
    const candidates = results.filter((item): item is ScannerCandidate => item !== null);

    const sorted = [...candidates]
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.score - a.score)
      .slice(0, topLimit)
      .map((item) => ({ ...item, score: Number(item.score.toFixed(4)) }));

    return {
      timestamp: new Date().toISOString(),
      count: sorted.length,
      candidates: sorted,
      ...(unresolvedSymbols.length > 0 ? { unresolvedSymbols } : {})
    };
  }

  private async analyzeCandidate(
    symbol: string,
    tickerBySymbol: Map<string, ScannerCandidate['market']>,
    opts: { primaryTimeframe: Timeframe; secondaryTimeframe: Timeframe; minTurnover: number }
  ): Promise<ScannerCandidate> {
    const { primaryTimeframe, secondaryTimeframe, minTurnover } = opts;
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
}
