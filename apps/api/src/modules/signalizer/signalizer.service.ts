import { Injectable } from '@nestjs/common';
import { PrismaSignalHistoryRepository } from './repositories/prisma-signal-history.repository.js';
import { PrismaSignalTransitionRepository } from './repositories/prisma-signal-transition.repository.js';

type HistoryFilter = { symbol?: string; state?: string; from?: string; to?: string; limit?: number };
type TransitionFilter = { symbol?: string; from?: string; to?: string };

@Injectable()
export class SignalizerService {
  constructor(
    private readonly historyRepo: PrismaSignalHistoryRepository,
    private readonly transitionRepo: PrismaSignalTransitionRepository
  ) {}

  async createObservation(input: any) {
    const {
      symbol,
      pairAnalyzed,
      targetBotPair,
      previousState,
      state: currentState,
      confidence,
      setup,
      aiAnalysis,
      reasons,
      rejectionReasons,
      usdcAvailable,
      pairValidation,
      currentPrice,
      market
    } = input;

    const observedAt = input.generatedAt ? new Date(input.generatedAt) : new Date();

    const created = await this.historyRepo.create({
      symbol: (symbol ?? pairAnalyzed ?? 'UNKNOWN').toUpperCase(),
      sourceSymbol: pairAnalyzed ?? symbol ?? 'UNKNOWN',
      targetSymbol: targetBotPair ?? 'UNKNOWN',
      observedAt,
      previousState: previousState ?? null,
      currentState,
      confidence: confidence ?? null,
      risk: (setup?.risk as string) ?? aiAnalysis?.risk ?? null,
      setupSnapshot: setup ?? {},
      aiDecision: aiAnalysis?.decision ?? null,
      reasons: reasons ?? [],
      rejections: rejectionReasons ?? [],
      usdcAvailable: !!usdcAvailable,
      pairValidation: pairValidation ?? {},
      currentPrice: currentPrice ?? market?.price ?? 0,
      timeframeInfo: market ?? {}
    });

    const last = await this.historyRepo.findLatestBySymbol(created.symbol);
    const prevState = last?.currentState ?? null;

    let transition = null;
    let transitionCreated = false;

    if (prevState !== null && prevState !== created.currentState) {
      transition = await this.transitionRepo.create({
        symbol: created.symbol,
        fromState: prevState,
        toState: created.currentState,
        observedAt: created.observedAt,
        observationId: created.id
      });
      transitionCreated = true;
    }

    return { observation: created, transitionCreated, transition };
  }

  async getHistory(filter: HistoryFilter) {
    const res = await this.historyRepo.find({
      symbol: filter.symbol?.toUpperCase(),
      state: filter.state,
      from: filter.from ? new Date(filter.from) : undefined,
      to: filter.to ? new Date(filter.to) : undefined,
      limit: filter.limit ?? 100
    });

    return { count: res.length, items: res };
  }

  async getTransitions(filter: TransitionFilter) {
    const res = await this.transitionRepo.find({
      symbol: filter.symbol?.toUpperCase(),
      from: filter.from,
      to: filter.to
    });
    return { count: res.length, items: res };
  }

  async getCurrentState(symbol: string) {
    const latest = await this.historyRepo.findLatestBySymbol(symbol.toUpperCase());
    if (!latest) return { symbol: symbol.toUpperCase(), currentState: null };

    const lastTransition = await this.transitionRepo.findLatestBySymbol(symbol.toUpperCase());

    return {
      symbol: latest.symbol,
      currentState: latest.currentState,
      previousState: latest.previousState ?? null,
      lastTransitionTimestamp: lastTransition ? lastTransition.observedAt : null,
      confidence: latest.confidence,
      risk: latest.risk,
      setup: latest.setupSnapshot,
      reasons: latest.reasons,
      rejections: latest.rejections,
      usdcAvailable: latest.usdcAvailable,
      pairValidation: latest.pairValidation,
      lastAnalysisTimestamp: latest.observedAt
    };
  }
}
