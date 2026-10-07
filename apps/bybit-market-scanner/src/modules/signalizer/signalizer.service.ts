import type { ScannerCandidate } from '../scanner/scanner.types.js';
import type { MarketService } from '../market/market.service.js';
import type { ScannerService } from '../scanner/scanner.service.js';
import type { MarketSignal, SignalState, SignalizerScanResult } from './signalizer.types.js';
import type { SignalStateStore } from './state/signal-state.store.js';

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

  constructor(
    private readonly marketService: MarketService,
    private readonly scannerService: ScannerService,
    private readonly stateStore: SignalStateStore
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

      const signals = scannerResult.candidates.map((candidate) => {
        const signal = this.buildSignal(candidate, usdcSymbols, generatedAt);
        this.stateStore.set(signal.symbol, signal);
        return signal;
      });

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

  private buildSignal(candidate: ScannerCandidate, usdcSymbols: Set<string>, generatedAt: string): MarketSignal {
    const pairAnalyzed = candidate.symbol;
    const baseCoin = getBaseCoin(pairAnalyzed);
    const targetBotPair = `${baseCoin}USDC`;
    const usdcAvailable = usdcSymbols.has(targetBotPair);
    const previousState = this.stateStore.get(pairAnalyzed)?.state;
    const baseState = resolveBaseState(candidate);
    const state = maybeInvalidate(previousState, baseState);

    const reasons = dedupe([...candidate.reasons, ...candidate.entryReasons]);

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
      rejectionReasons: candidate.rejectionReasons,
      generatedAt,
      ...(previousState !== undefined ? { previousState } : {}),
      stateChanged: previousState !== undefined && previousState !== state
    };
  }
}
