import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PrismaSignalHistoryRepository } from './repositories/prisma-signal-history.repository.js';
import { PrismaSignalTransitionRepository } from './repositories/prisma-signal-transition.repository.js';

type HistoryFilter = { symbol?: string; state?: string; from?: string; to?: string; limit?: number };
type TransitionFilter = { symbol?: string; from?: string; to?: string };

@Injectable()
export class SignalizerService {
  constructor(
    private readonly historyRepo: PrismaSignalHistoryRepository,
    private readonly transitionRepo: PrismaSignalTransitionRepository,
    private readonly prismaService?: PrismaService
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

    const symbolNorm = (symbol ?? pairAnalyzed ?? 'UNKNOWN').toUpperCase();

    // determine backend and ai states
    const backendState = currentState as string;
    const aiState = (aiAnalysis?.state ?? input.finalState) as string | undefined;

    // helper: decide final persisted state according to audit rules
    const decideFinalState = (backend: string, ai?: string, usdcAvail?: boolean, pairVal?: any, setupObj?: any) => {
      // default: respect backend
      let finalState = backend;

      // If backend is READY, AI may downgrade or block READY
      if (backend === 'READY') {
        if (ai && ai !== 'READY') {
          // AI explicitly downgraded
          finalState = ai as any;
        } else {
          // AI says READY (or missing) -> must still check USDC and basic setup validity
          const usdcOk = !!usdcAvail || (pairVal && pairVal.status === 'USDC_READY');
          const setupValid = !!setupObj && typeof setupObj.gridCount === 'number' && setupObj.gridCount > 0 && (setupObj.investment ?? 0) > 0;
          if (!usdcOk) {
            finalState = 'MANUAL_CHECK_REQUIRED';
          } else if (!setupValid) {
            finalState = 'MANUAL_CHECK_REQUIRED';
          } else {
            finalState = 'READY';
          }
        }
      } else {
        // backend not READY -> AI must not upgrade to READY
        if (ai === 'READY') {
          // ignore AI upgrade
          finalState = backend;
        } else if (ai && ai !== 'READY') {
          // allow AI to advise a more restrictive state (downgrade) only when backend is READY;
          // for non-READY backends, keep backend state authoritative
          finalState = backend;
        }
      }

      return finalState;
    };

    // Use Prisma transaction when available; repositories accept an optional tx client.
    // If Prisma is not injected (e.g., unit tests using in-memory repos), fall back to non-transactional but still read-before-insert logic.
    const prismaService: any = (this as any).prismaService ?? (this as any).prisma ?? null;

    if (prismaService && typeof prismaService.$transaction === 'function') {
      const result = await prismaService.$transaction(async (tx: any) => {
        const last = await this.historyRepo.findLatestBySymbol(symbolNorm, tx);
        const prevState = last?.currentState ?? null;

        const persistState = decideFinalState(backendState, aiState, usdcAvailable, pairValidation, setup);

        const created = await this.historyRepo.create({
          symbol: symbolNorm,
          sourceSymbol: pairAnalyzed ?? symbol ?? 'UNKNOWN',
          targetSymbol: targetBotPair ?? 'UNKNOWN',
          observedAt,
          previousState: prevState ?? null,
          currentState: persistState,
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
        }, tx);

        let transition = null;
        let transitionCreated = false;
        if (prevState !== null && prevState !== created.currentState) {
          transition = await this.transitionRepo.create({
            symbol: created.symbol,
            fromState: prevState,
            toState: created.currentState,
            observedAt: created.observedAt,
            observationId: created.id
          }, tx);
          transitionCreated = true;
        }

        return { observation: created, transitionCreated, transition };
      });

      return result;
    }

    // Fallback (no Prisma): read-before-insert using provided repositories (suitable for unit tests)
    const last = await this.historyRepo.findLatestBySymbol(symbolNorm as any);
    const prevState = last?.currentState ?? null;
    const persistState = decideFinalState(backendState, aiState, usdcAvailable, pairValidation, setup);

    const created = await this.historyRepo.create({
      symbol: symbolNorm,
      sourceSymbol: pairAnalyzed ?? symbol ?? 'UNKNOWN',
      targetSymbol: targetBotPair ?? 'UNKNOWN',
      observedAt,
      previousState: prevState ?? null,
      currentState: persistState,
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
