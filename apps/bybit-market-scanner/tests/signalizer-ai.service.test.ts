import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../src/config/config.js';
import { loadConfig } from '../src/config/config.js';
import { SignalizerAiService } from '../src/modules/signalizer/ai/signalizer-ai.service.js';
import { SignalizerService } from '../src/modules/signalizer/signalizer.service.js';
import { InMemorySignalStateStore } from '../src/modules/signalizer/state/signal-state.store.js';
import type { SignalizerAiAnalyzer } from '../src/modules/signalizer/ai/ai-analysis.types.js';
import type { MarketSignal } from '../src/modules/signalizer/signalizer.types.js';
import type { ScannerCandidate } from '../src/modules/scanner/scanner.types.js';
import type { MarketService } from '../src/modules/market/market.service.js';
import type { ScannerService } from '../src/modules/scanner/scanner.service.js';

function withAiConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const base = loadConfig();
  return {
    ...base,
    aiEnabled: true,
    aiModel: 'test-model',
    aiTimeoutMs: 500,
    aiMaxRetries: 0,
    aiMaxCandidates: 5,
    ...overrides
  };
}

function makeSignal(overrides: Partial<MarketSignal> = {}): MarketSignal {
  return {
    symbol: 'SPXUSDT',
    pairAnalyzed: 'SPXUSDT',
    targetBotPair: 'SPXUSDC',
    quoteAsset: 'USDT',
    usdcAvailable: true,
    state: 'READY',
    currentPrice: 100,
    price24hChangePercent: 1.5,
    turnover24h: 2_500_000,
    score: 81,
    reasons: ['PASSES_FILTERS'],
    rejectionReasons: [],
    generatedAt: '2026-10-08T00:00:00.000Z',
    stateChanged: false,
    pairValidation: { status: 'USDC_READY' },
    market: {
      timeframe4h: {
        trend: 'SIDEWAYS',
        support: 97,
        resistance: 106,
        rangeLow: 95,
        rangeHigh: 108,
        rangePercent: 12,
        positionInRange: 42,
        volatility: 1.2,
        trendStrength: 1.1,
        momentum: 'NEUTRAL'
      },
      timeframe1h: {
        trend: 'SIDEWAYS',
        support: 98,
        resistance: 104,
        rangeLow: 97,
        rangeHigh: 105,
        rangePercent: 8,
        positionInRange: 45,
        volatility: 1,
        trendStrength: 1.1,
        momentum: 'NEUTRAL'
      },
      timeframe15m: {
        trend: 'SIDEWAYS',
        support: 99,
        resistance: 103,
        rangeLow: 98,
        rangeHigh: 104,
        rangePercent: 6,
        positionInRange: 50,
        volatility: 0.9,
        trendStrength: 0.7,
        momentum: 'NEUTRAL',
        higherLow: true,
        stabilizing: true,
        supportHeld: true
      }
    },
    setup: {
      entryLow: 99.4,
      entryHigh: 100.6,
      gridLow: 98.2,
      gridHigh: 103.4,
      gridCount: 8,
      stopLoss: 96.9,
      takeProfit: 102.7,
      trailingStopPercent: 4,
      trailingUp: false,
      investment: 300,
      risk: 'MEDIUM',
      confidence: 77,
      distanceToResistancePercent: 2.7,
      distanceToInvalidationPercent: 2.5
    },
    ...overrides
  };
}

function aiPayload(signal: MarketSignal, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const setup = signal.setup;
  if (!setup) throw new Error('setup is required');

  return {
    state: 'READY',
    symbol: signal.symbol,
    targetBotPair: signal.targetBotPair,
    decision: 'RUN_GRID',
    setup: {
      entryLow: setup.entryLow,
      entryHigh: setup.entryHigh,
      gridLow: setup.gridLow,
      gridHigh: setup.gridHigh,
      gridCount: setup.gridCount,
      stopLoss: setup.stopLoss,
      takeProfit: setup.takeProfit,
      investment: setup.investment,
      trailingStopPercent: setup.trailingStopPercent,
      trailingUp: setup.trailingUp
    },
    risk: setup.risk,
    confidence: 84,
    reasons: ['structure aligned'],
    warnings: [],
    waitingFor: [],
    ...overrides
  };
}

function makeCandidate(symbol: string, score: number, overrides: Partial<ScannerCandidate> = {}): ScannerCandidate {
  return {
    symbol,
    score,
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

function makeCandles() {
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

  return closes.map((close, index) => ({
    timestamp: Date.now() - (closes.length - index) * 15 * 60_000,
    open: close,
    high: close * 1.002,
    low: close * 0.998,
    close,
    volume: 1_000,
    turnover: 100_000,
    isClosed: true
  }));
}

describe('signalizer ai analyzer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('READY backend + valid AI -> READY', async () => {
    const signal = makeSignal();
    const analyzer: SignalizerAiAnalyzer = {
      analyze: vi.fn().mockResolvedValue(aiPayload(signal))
    };

    const service = new SignalizerAiService(withAiConfig(), analyzer);
    const result = await service.analyzeSignal(signal);

    expect(result.state).toBe('READY');
  });

  it('READY backend + AI says WATCH -> WATCH', async () => {
    const signal = makeSignal();
    const analyzer: SignalizerAiAnalyzer = {
      analyze: vi.fn().mockResolvedValue(aiPayload(signal, { state: 'WATCH', decision: 'WAIT' }))
    };

    const service = new SignalizerAiService(withAiConfig(), analyzer);
    const result = await service.analyzeSignal(signal);

    expect(result.state).toBe('WATCH');
  });

  it('READY backend + AI says NO_TRADE -> NO_TRADE', async () => {
    const signal = makeSignal();
    const analyzer: SignalizerAiAnalyzer = {
      analyze: vi.fn().mockResolvedValue(aiPayload(signal, { state: 'NO_TRADE', decision: 'NO_EXECUTION' }))
    };

    const service = new SignalizerAiService(withAiConfig(), analyzer);
    const result = await service.analyzeSignal(signal);

    expect(result.state).toBe('NO_TRADE');
  });

  it('USDC unavailable -> MANUAL_CHECK_REQUIRED', async () => {
    const signal = makeSignal({
      usdcAvailable: false,
      pairValidation: { status: 'MANUAL_CHECK_REQUIRED' }
    });
    const analyzer: SignalizerAiAnalyzer = {
      analyze: vi.fn().mockResolvedValue(
        aiPayload(signal, {
          state: 'MANUAL_CHECK_REQUIRED',
          decision: 'MANUAL_CHECK'
        })
      )
    };

    const service = new SignalizerAiService(withAiConfig(), analyzer);
    const result = await service.analyzeSignal(signal);

    expect(result.state).toBe('MANUAL_CHECK_REQUIRED');
  });

  it('AI changes entryLow -> response rejected', async () => {
    const signal = makeSignal();
    const analyzer: SignalizerAiAnalyzer = {
      analyze: vi.fn().mockResolvedValue(aiPayload(signal, { setup: { ...(aiPayload(signal).setup as object), entryLow: 88 } }))
    };

    const service = new SignalizerAiService(withAiConfig(), analyzer);
    const result = await service.analyzeSignal(signal);

    expect(result.state).toBe('NO_TRADE');
    expect(result.reasons).toContain('AI_RESPONSE_INVALID');
  });

  it('AI changes gridHigh -> response rejected', async () => {
    const signal = makeSignal();
    const setup = aiPayload(signal).setup as Record<string, unknown>;
    const analyzer: SignalizerAiAnalyzer = {
      analyze: vi.fn().mockResolvedValue(aiPayload(signal, { setup: { ...setup, gridHigh: 999 } }))
    };

    const service = new SignalizerAiService(withAiConfig(), analyzer);
    const result = await service.analyzeSignal(signal);

    expect(result.state).toBe('NO_TRADE');
    expect(result.reasons).toContain('AI_RESPONSE_INVALID');
  });

  it('AI returns invalid JSON -> safe fallback', async () => {
    const signal = makeSignal();
    const analyzer: SignalizerAiAnalyzer = {
      analyze: vi.fn().mockResolvedValue('{invalid-json')
    };

    const service = new SignalizerAiService(withAiConfig(), analyzer);
    const result = await service.analyzeSignal(signal);

    expect(result.state).toBe('NO_TRADE');
    expect(result.reasons).toContain('AI_RESPONSE_INVALID');
  });

  it('AI returns NaN/Infinity -> rejected', async () => {
    const signal = makeSignal();
    const analyzer: SignalizerAiAnalyzer = {
      analyze: vi.fn().mockResolvedValue(aiPayload(signal, { confidence: Number.POSITIVE_INFINITY }))
    };

    const service = new SignalizerAiService(withAiConfig(), analyzer);
    const result = await service.analyzeSignal(signal);

    expect(result.state).toBe('NO_TRADE');
    expect(result.reasons).toContain('AI_RESPONSE_INVALID');
  });

  it('confidence validation rejects out of bounds', async () => {
    const signal = makeSignal();
    const analyzer: SignalizerAiAnalyzer = {
      analyze: vi.fn().mockResolvedValue(aiPayload(signal, { confidence: 101 }))
    };

    const service = new SignalizerAiService(withAiConfig(), analyzer);
    const result = await service.analyzeSignal(signal);

    expect(result.reasons).toContain('AI_RESPONSE_INVALID');
  });

  it('symbol mismatch rejected', async () => {
    const signal = makeSignal();
    const analyzer: SignalizerAiAnalyzer = {
      analyze: vi.fn().mockResolvedValue(aiPayload(signal, { symbol: 'BTCUSDT' }))
    };

    const service = new SignalizerAiService(withAiConfig(), analyzer);
    const result = await service.analyzeSignal(signal);

    expect(result.reasons).toContain('AI_RESPONSE_INVALID');
  });

  it('targetBotPair mismatch rejected', async () => {
    const signal = makeSignal();
    const analyzer: SignalizerAiAnalyzer = {
      analyze: vi.fn().mockResolvedValue(aiPayload(signal, { targetBotPair: 'SPXUSDT' }))
    };

    const service = new SignalizerAiService(withAiConfig(), analyzer);
    const result = await service.analyzeSignal(signal);

    expect(result.reasons).toContain('AI_RESPONSE_INVALID');
  });

  it('AI disabled -> existing Signalizer unchanged', async () => {
    const marketService = {
      getMarketsByQuoteCoin: vi.fn().mockResolvedValue([
        { symbol: 'SOLUSDC', baseCoin: 'SOL', quoteCoin: 'USDC', status: 'Trading' }
      ]),
      getCandles: vi.fn().mockResolvedValue(makeCandles())
    } as unknown as MarketService;

    const scannerService = {
      scan: vi.fn().mockResolvedValue({
        timestamp: '2026-10-08T00:00:00.000Z',
        count: 1,
        candidates: [makeCandidate('SOLUSDT', 88)]
      })
    } as unknown as ScannerService;

    const cfg = withAiConfig({ aiEnabled: false });
    const aiAnalyzer: SignalizerAiAnalyzer = { analyze: vi.fn().mockResolvedValue({}) };
    const aiService = new SignalizerAiService(cfg, aiAnalyzer);

    const service = new SignalizerService(
      marketService,
      scannerService,
      new InMemorySignalStateStore(),
      cfg,
      aiService
    );

    const result = await service.scan();

    expect(result.signals[0]?.state).toBe('READY');
    expect(result.signals[0]?.aiAnalysis).toBeUndefined();
    expect(vi.mocked(aiAnalyzer.analyze)).not.toHaveBeenCalled();
  });

  it('AI candidate limit works', async () => {
    const marketService = {
      getMarketsByQuoteCoin: vi.fn().mockResolvedValue([
        { symbol: 'SOLUSDC', baseCoin: 'SOL', quoteCoin: 'USDC', status: 'Trading' },
        { symbol: 'ADAUSDC', baseCoin: 'ADA', quoteCoin: 'USDC', status: 'Trading' }
      ]),
      getCandles: vi.fn().mockResolvedValue(makeCandles())
    } as unknown as MarketService;

    const scannerService = {
      scan: vi.fn().mockResolvedValue({
        timestamp: '2026-10-08T00:00:00.000Z',
        count: 2,
        candidates: [makeCandidate('SOLUSDT', 90), makeCandidate('ADAUSDT', 80)]
      })
    } as unknown as ScannerService;

    const cfg = withAiConfig({ aiEnabled: true, aiMaxCandidates: 1 });
    const aiAnalyzer: SignalizerAiAnalyzer = {
      analyze: vi.fn().mockImplementation(async (context) => ({
        state: 'WATCH',
        symbol: context.symbol,
        targetBotPair: context.targetBotPair,
        decision: 'WAIT',
        setup: {
          entryLow: context.setup.entryLow,
          entryHigh: context.setup.entryHigh,
          gridLow: context.setup.gridLow,
          gridHigh: context.setup.gridHigh,
          gridCount: context.setup.gridCount,
          stopLoss: context.setup.stopLoss,
          takeProfit: context.setup.takeProfit,
          investment: context.setup.investment,
          trailingStopPercent: context.setup.trailingStopPercent,
          trailingUp: context.setup.trailingUp
        },
        risk: context.setup.risk,
        confidence: 70,
        reasons: ['waiting for confirmation'],
        warnings: [],
        waitingFor: ['15M_CONFIRMATION']
      }))
    };

    const aiService = new SignalizerAiService(cfg, aiAnalyzer);
    const service = new SignalizerService(
      marketService,
      scannerService,
      new InMemorySignalStateStore(),
      cfg,
      aiService
    );

    const result = await service.scan();

    expect(vi.mocked(aiAnalyzer.analyze)).toHaveBeenCalledTimes(1);
    const withAi = result.signals.filter((item) => item.aiAnalysis);
    expect(withAi).toHaveLength(1);
    expect(withAi[0]?.symbol).toBe('SOLUSDT');
  });

  it('NO_TRADE does not trigger AI by default', async () => {
    const marketService = {
      getMarketsByQuoteCoin: vi.fn().mockResolvedValue([
        { symbol: 'SOLUSDC', baseCoin: 'SOL', quoteCoin: 'USDC', status: 'Trading' }
      ]),
      getCandles: vi.fn().mockResolvedValue(makeCandles())
    } as unknown as MarketService;

    const scannerService = {
      scan: vi.fn().mockResolvedValue({
        timestamp: '2026-10-08T00:00:00.000Z',
        count: 2,
        candidates: [
          makeCandidate('SOLUSDT', 90),
          makeCandidate('DOGEUSDT', 40, {
            status: 'REJECTED',
            entryTiming: 'NO_ENTRY',
            rejectionReasons: ['STRONG_DOWNTREND']
          })
        ]
      })
    } as unknown as ScannerService;

    const cfg = withAiConfig({ aiEnabled: true, aiMaxCandidates: 5 });
    const aiAnalyzer: SignalizerAiAnalyzer = {
      analyze: vi.fn().mockImplementation(async (context) => aiPayload(makeSignal({ symbol: context.symbol, pairAnalyzed: context.symbol, targetBotPair: context.targetBotPair })))
    };

    const aiService = new SignalizerAiService(cfg, aiAnalyzer);
    const service = new SignalizerService(
      marketService,
      scannerService,
      new InMemorySignalStateStore(),
      cfg,
      aiService
    );

    const result = await service.scan();

    const noTradeSignal = result.signals.find((item) => item.symbol === 'DOGEUSDT');
    expect(noTradeSignal?.state).toBe('NO_TRADE');
    expect(noTradeSignal?.aiAnalysis).toBeUndefined();
    expect(vi.mocked(aiAnalyzer.analyze)).toHaveBeenCalledTimes(1);
  });
});
