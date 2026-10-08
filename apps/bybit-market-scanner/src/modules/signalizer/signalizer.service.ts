import type { ScannerCandidate } from '../scanner/scanner.types.js';
import type { AppConfig } from '../../config/config.js';
import type { MarketAnalysis } from '../analysis/analysis.types.js';
import { analyzeTrend } from '../analysis/trend.js';
import { calculateRangeMetrics } from '../analysis/range.js';
import { calculateVolatilityPercent } from '../analysis/volatility.js';
import { calculateSupportResistance } from '../analysis/support-resistance.js';
import { round } from '../../shared/utils/math.js';
import { mapWithConcurrency } from '../../shared/utils/promise-pool.js';
import type { MarketService } from '../market/market.service.js';
import type { ScannerService } from '../scanner/scanner.service.js';
import type { MarketSignal, SignalState, SignalizerScanResult } from './signalizer.types.js';
import type { SignalStateStore } from './state/signal-state.store.js';
import { GridSetupGenerator } from './setup/grid-setup.generator.js';

function hasAnyReason(reasons: string[], values: string[]): boolean {
  return values.some((value) => reasons.includes(value));
}

function resolveBaseState(candidate: ScannerCandidate): SignalState {
  const rejectionReasons = candidate.rejectionReasons;

  if (candidate.status === 'REJECTED') {
    return 'NO_TRADE';
  }

  if (
    hasAnyReason(rejectionReasons, [
      'LOW_LIQUIDITY',
      'STRONG_DOWNTREND',
      'TREND_TOO_STRONG',
      'RANGE_OUT_OF_BOUNDS',
      'VOLATILITY_OUT_OF_BOUNDS'
    ]) ||
    candidate.entryTiming === 'NO_ENTRY'
  ) {
    return 'NO_TRADE';
  }

  if (
    rejectionReasons.includes('INSUFFICIENT_CANDLES') ||
    !candidate.analysis1h ||
    !candidate.analysis15m
  ) {
    return 'WATCH';
  }

  if (candidate.entryTiming === 'READY' && rejectionReasons.length === 0 && candidate.status === 'CANDIDATE') {
    return 'READY';
  }

  if (
    candidate.status === 'CANDIDATE' &&
    (candidate.entryTiming === 'WAIT_CONFIRMATION' ||
      candidate.entryTiming === 'WAIT_PULLBACK' ||
      candidate.entryTiming === 'WAIT_BREAKOUT_RETEST')
  ) {
    return 'SETUP_FORMING';
  }

  return 'WATCH';
}

function maybeInvalidate(previousState: SignalState | undefined, currentState: SignalState): SignalState {
  const previouslyInteresting =
    previousState === 'WATCH' || previousState === 'SETUP_FORMING' || previousState === 'READY';

  if (previouslyInteresting && currentState === 'NO_TRADE') {
    return 'INVALIDATED';
  }

  return currentState;
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}

function getBaseCoin(symbol: string): string {
  if (symbol.endsWith('USDT')) return symbol.slice(0, -4);
  if (symbol.endsWith('USDC')) return symbol.slice(0, -4);
  return symbol;
}

export class SignalizerService {
  private running = false;
  private readonly gridSetupGenerator = new GridSetupGenerator();

  constructor(
    private readonly marketService: MarketService,
    private readonly scannerService: ScannerService,
    private readonly stateStore: SignalStateStore,
    private readonly config: AppConfig
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async scan(): Promise<SignalizerScanResult> {
    if (this.running) {
      const signals = this.stateStore.getAll();
      return {
        generatedAt: new Date().toISOString(),
        isRunning: true,
        skipped: true,
        count: signals.length,
        stateChangedCount: 0,
        signals
      };
    }

    this.running = true;

    try {
      const [usdcMarkets, scannerResult] = await Promise.all([
        this.marketService.getMarketsByQuoteCoin('USDC'),
        this.scannerService.scan({ quoteCoin: 'USDT', minTurnover: 0, limit: Number.MAX_SAFE_INTEGER })
      ]);

      const generatedAt = scannerResult.timestamp;
      const usdcSymbols = new Set(usdcMarkets.map((market) => market.symbol));

      const signals = await mapWithConcurrency(
        scannerResult.candidates,
        this.config.signalizerMaxConcurrentSetups,
        async (candidate) => {
          const signal = await this.buildSignal(candidate, usdcSymbols, generatedAt);
          this.stateStore.set(signal.symbol, signal);
          return signal;
        }
      );

      return {
        generatedAt,
        isRunning: false,
        skipped: false,
        count: signals.length,
        stateChangedCount: signals.filter((signal) => signal.stateChanged).length,
        signals
      };
    } finally {
      this.running = false;
    }
  }

  private async buildAnalysis4h(candidate: ScannerCandidate): Promise<MarketAnalysis> {
    const candles4h = await this.marketService.getCandles(candidate.symbol, '4h', this.config.analysisCandleLimit);
    const closedCandles = candles4h.filter((item) => item.isClosed);

    const price = candidate.market.lastPrice;
    const range = calculateRangeMetrics(closedCandles, price);
    const trend = analyzeTrend(closedCandles);
    const volatilityPercent = calculateVolatilityPercent(closedCandles);
    const sr = calculateSupportResistance(closedCandles, price, {
      swingWindow: this.config.srSwingWindow,
      clusterPercent: this.config.srClusterPercent,
      minTouches: this.config.srMinTouches
    });

    return {
      symbol: candidate.symbol,
      price,
      change24hPercent: round(candidate.market.change24hPercent),
      volume24h: round(candidate.market.volume24h),
      turnover24h: round(candidate.market.turnover24h),
      timeframe: '4h',
      rangeHigh: range.rangeHigh,
      rangeLow: range.rangeLow,
      rangePercent: range.rangePercent,
      support: sr.support,
      resistance: sr.resistance,
      distanceToSupportPercent: sr.distanceToSupportPercent,
      distanceToResistancePercent: sr.distanceToResistancePercent,
      positionInRangePercent: range.positionInRangePercent,
      volatilityPercent,
      trendDirection: trend.trendDirection,
      trendStrength: trend.trendStrength,
      liquidityScore: 0,
      gridScore: 0,
      rejectionReasons: []
    };
  }

  private async buildSignal(
    candidate: ScannerCandidate,
    usdcSymbols: Set<string>,
    generatedAt: string
  ): Promise<MarketSignal> {
    const pairAnalyzed = candidate.symbol;
    const baseCoin = getBaseCoin(pairAnalyzed);
    const targetBotPair = `${baseCoin}USDC`;
    const usdcAvailable = usdcSymbols.has(targetBotPair);
    const previousState = this.stateStore.get(pairAnalyzed)?.state;
    const baseState = resolveBaseState(candidate);

    let market = undefined;
    let setup = undefined;
    let pairValidation = {
      status: usdcAvailable ? 'USDC_READY' : 'MANUAL_CHECK_REQUIRED'
    } as const;

    const extraReasons: string[] = [];
    const extraRejectionReasons: string[] = [];

    if (candidate.analysis1h && candidate.analysis15m) {
      try {
        const [analysis4h, candles15m] = await Promise.all([
          this.buildAnalysis4h(candidate),
          this.marketService.getCandles(candidate.symbol, '15m', 80)
        ]);

        const setupEvaluation = this.gridSetupGenerator.evaluate({
          config: this.config,
          state: baseState,
          market: {
            symbol: candidate.symbol,
            currentPrice: candidate.market.lastPrice,
            turnover24h: candidate.market.turnover24h
          },
          analysis4h,
          analysis1h: candidate.analysis1h,
          analysis15m: candidate.analysis15m,
          candles15m,
          usdcAvailable
        });

        market = setupEvaluation.market;
        setup = setupEvaluation.setup;
        pairValidation = setupEvaluation.pairValidation;
        extraReasons.push(...setupEvaluation.reasons);
        extraRejectionReasons.push(...setupEvaluation.rejectionReasons);

        const finalizedBaseState = setupEvaluation.state;
        const state = maybeInvalidate(previousState, finalizedBaseState);

        const reasons = dedupe([...candidate.reasons, ...candidate.entryReasons, ...extraReasons]);
        const rejectionReasons = dedupe([...candidate.rejectionReasons, ...extraRejectionReasons]);

        return {
          symbol: pairAnalyzed,
          pairAnalyzed,
          targetBotPair,
          quoteAsset: 'USDT',
          usdcAvailable,
          state,
          currentPrice: candidate.market.lastPrice,
          price24hChangePercent: candidate.market.change24hPercent,
          turnover24h: candidate.market.turnover24h,
          score: Number(candidate.score.toFixed(4)),
          reasons,
          rejectionReasons,
          generatedAt,
          market,
          ...(setup ? { setup } : {}),
          pairValidation,
          ...(previousState !== undefined ? { previousState } : {}),
          stateChanged: previousState !== undefined && previousState !== state
        };
      } catch {
        extraRejectionReasons.push('SETUP_GENERATION_ERROR');
      }
    }

    const state = maybeInvalidate(previousState, baseState);

    const reasons = dedupe([...candidate.reasons, ...candidate.entryReasons, ...extraReasons]);
    const rejectionReasons = dedupe([...candidate.rejectionReasons, ...extraRejectionReasons]);

    return {
      symbol: pairAnalyzed,
      pairAnalyzed,
      targetBotPair,
      quoteAsset: 'USDT',
      usdcAvailable,
      state,
      currentPrice: candidate.market.lastPrice,
      price24hChangePercent: candidate.market.change24hPercent,
      turnover24h: candidate.market.turnover24h,
      score: Number(candidate.score.toFixed(4)),
      reasons,
      rejectionReasons,
      generatedAt,
      ...(market ? { market } : {}),
      ...(setup ? { setup } : {}),
      pairValidation,
      ...(previousState !== undefined ? { previousState } : {}),
      stateChanged: previousState !== undefined && previousState !== state
    };
  }
}
