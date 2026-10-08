import { logger } from '../../../shared/utils/logger.js';
import type { AppConfig } from '../../../config/config.js';
import type { GridBotSetup, MarketSignal, TimeframeAnalysis } from '../signalizer.types.js';
import type { AiAnalysisContext, AiAnalysisResult, SignalizerAiAnalyzer } from './ai-analysis.types.js';
import { validateAiAnalysisResponse } from './ai-analysis.validator.js';
import { OpenAiCompatibleSignalizerAiAnalyzer } from './providers/openai-compatible-signalizer-ai-analyzer.js';

function hasSetup(signal: MarketSignal): signal is MarketSignal & { setup: GridBotSetup } {
  return !!signal.setup;
}

function asTimeframe(input: TimeframeAnalysis | undefined): TimeframeAnalysis {
  return input ?? { trend: 'SIDEWAYS' };
}

function createFallbackFromSignal(signal: MarketSignal, reason: string): AiAnalysisResult {
  const setup = signal.setup;
  if (!setup) {
    return {
      state: 'NO_TRADE',
      symbol: signal.symbol,
      targetBotPair: signal.targetBotPair,
      decision: 'NO_EXECUTION',
      setup: {
        entryLow: 0,
        entryHigh: 0,
        gridLow: 0,
        gridHigh: 0,
        gridCount: 0,
        stopLoss: 0,
        takeProfit: 0,
        investment: 0,
        trailingStopPercent: 0,
        trailingUp: false
      },
      risk: 'HIGH',
      confidence: 0,
      reasons: [reason],
      warnings: [],
      waitingFor: ['GRID_SETUP_CONTEXT']
    };
  }

  return {
    state: 'NO_TRADE',
    symbol: signal.symbol,
    targetBotPair: signal.targetBotPair,
    decision: 'NO_EXECUTION',
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
    confidence: 0,
    reasons: [reason],
    warnings: [],
    waitingFor: []
  };
}

function toAiContext(signal: MarketSignal): AiAnalysisContext | null {
  if (!signal.market || !signal.setup || !signal.pairValidation) {
    return null;
  }

  return {
    symbol: signal.symbol,
    pairAnalyzed: signal.pairAnalyzed,
    targetBotPair: signal.targetBotPair,
    currentPrice: signal.currentPrice,
    price24hChangePercent: signal.price24hChangePercent,
    turnover24h: signal.turnover24h,
    score: signal.score,
    stateBeforeAi: signal.state,
    market: {
      '4h': asTimeframe(signal.market.timeframe4h),
      '1h': asTimeframe(signal.market.timeframe1h),
      '15m': asTimeframe(signal.market.timeframe15m)
    },
    setup: signal.setup,
    usdcAvailable: signal.usdcAvailable,
    pairValidation: signal.pairValidation,
    reasons: signal.reasons,
    rejectionReasons: signal.rejectionReasons
  };
}

export class SignalizerAiService {
  private readonly analyzer: SignalizerAiAnalyzer;

  constructor(
    private readonly config: AppConfig,
    analyzer?: SignalizerAiAnalyzer
  ) {
    this.analyzer =
      analyzer ??
      new OpenAiCompatibleSignalizerAiAnalyzer({
        apiKey: this.config.aiApiKey,
        endpoint: this.config.aiApiUrl,
        model: this.config.aiModel,
        timeoutMs: this.config.aiTimeoutMs,
        maxRetries: this.config.aiMaxRetries
      });
  }

  isEnabled(): boolean {
    return this.config.aiEnabled;
  }

  maxCandidates(): number {
    return this.config.aiMaxCandidates;
  }

  async analyzeSignal(signal: MarketSignal): Promise<AiAnalysisResult> {
    if (!this.isEnabled()) {
      return createFallbackFromSignal(signal, 'AI_DISABLED');
    }

    if (!hasSetup(signal)) {
      return createFallbackFromSignal(signal, 'GRID_SETUP_CONTEXT_MISSING');
    }

    const context = toAiContext(signal);
    if (!context) {
      return createFallbackFromSignal(signal, 'AI_CONTEXT_INCOMPLETE');
    }

    const startedAt = Date.now();

    try {
      const raw = await this.analyzer.analyze(context);
      const result = validateAiAnalysisResponse(raw, context);
      const latencyMs = Date.now() - startedAt;
      const isValid = !result.reasons.includes('AI_RESPONSE_INVALID');

      logger.info('signalizer ai analyzed', {
        symbol: signal.symbol,
        stateBeforeAi: signal.state,
        stateAfterAi: result.state,
        aiConfidence: result.confidence,
        latencyMs,
        validation: isValid ? 'VALID' : 'INVALID'
      });

      return result;
    } catch {
      const latencyMs = Date.now() - startedAt;
      const fallback = createFallbackFromSignal(signal, 'AI_RESPONSE_INVALID');

      logger.warn('signalizer ai analyze failed', {
        symbol: signal.symbol,
        stateBeforeAi: signal.state,
        stateAfterAi: fallback.state,
        aiConfidence: fallback.confidence,
        latencyMs,
        validation: 'INVALID'
      });

      return fallback;
    }
  }
}
