import type { AiAnalysisResult, AiSignalState, GridRisk } from '../signalizer.types.js';
import type { AiAnalysisContext } from './ai-analysis.types.js';

const VALID_STATES: ReadonlySet<AiSignalState> = new Set([
  'READY',
  'WATCH',
  'NO_TRADE',
  'MANUAL_CHECK_REQUIRED'
]);

const VALID_RISKS: ReadonlySet<GridRisk> = new Set(['LOW', 'MEDIUM', 'HIGH']);

const VALID_DECISIONS: ReadonlySet<AiAnalysisResult['decision']> = new Set([
  'RUN_GRID',
  'WAIT',
  'NO_EXECUTION',
  'MANUAL_CHECK'
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function fallback(context: AiAnalysisContext): AiAnalysisResult {
  return {
    state: 'NO_TRADE',
    symbol: context.symbol,
    targetBotPair: context.targetBotPair,
    decision: 'NO_EXECUTION',
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
    confidence: 0,
    reasons: ['AI_RESPONSE_INVALID'],
    warnings: [],
    waitingFor: []
  };
}

function parseRaw(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  return JSON.parse(candidate);
}

function sameNumber(a: number, b: unknown): boolean {
  return typeof b === 'number' && Number.isFinite(b) && Object.is(a, b);
}

export function validateAiAnalysisResponse(raw: unknown, context: AiAnalysisContext): AiAnalysisResult {
  let parsed: unknown;

  try {
    parsed = parseRaw(raw);
  } catch {
    return fallback(context);
  }

  if (!parsed || typeof parsed !== 'object') {
    return fallback(context);
  }

  const record = parsed as Record<string, unknown>;
  const setup = record.setup as Record<string, unknown> | undefined;

  if (
    typeof record.symbol !== 'string' ||
    record.symbol !== context.symbol ||
    typeof record.targetBotPair !== 'string' ||
    record.targetBotPair !== context.targetBotPair ||
    typeof record.state !== 'string' ||
    !VALID_STATES.has(record.state as AiSignalState) ||
    typeof record.risk !== 'string' ||
    !VALID_RISKS.has(record.risk as GridRisk) ||
    typeof record.decision !== 'string' ||
    !VALID_DECISIONS.has(record.decision as AiAnalysisResult['decision']) ||
    !Array.isArray(record.reasons) ||
    !Array.isArray(record.warnings) ||
    !Array.isArray(record.waitingFor) ||
    !isFiniteNumber(record.confidence) ||
    record.confidence < 0 ||
    record.confidence > 100 ||
    !setup
  ) {
    return fallback(context);
  }

  const sameSetupValues =
    sameNumber(context.setup.entryLow, setup.entryLow) &&
    sameNumber(context.setup.entryHigh, setup.entryHigh) &&
    sameNumber(context.setup.gridLow, setup.gridLow) &&
    sameNumber(context.setup.gridHigh, setup.gridHigh) &&
    sameNumber(context.setup.gridCount, setup.gridCount) &&
    sameNumber(context.setup.stopLoss, setup.stopLoss) &&
    sameNumber(context.setup.takeProfit, setup.takeProfit) &&
    sameNumber(context.setup.investment, setup.investment) &&
    sameNumber(context.setup.trailingStopPercent, setup.trailingStopPercent) &&
    typeof setup.trailingUp === 'boolean' &&
    setup.trailingUp === context.setup.trailingUp;

  if (!sameSetupValues) {
    return fallback(context);
  }

  if (
    !isNonNegativeNumber(setup.entryLow) ||
    !isNonNegativeNumber(setup.entryHigh) ||
    !isNonNegativeNumber(setup.gridLow) ||
    !isNonNegativeNumber(setup.gridHigh) ||
    !isNonNegativeNumber(setup.stopLoss) ||
    !isNonNegativeNumber(setup.takeProfit) ||
    !isNonNegativeNumber(setup.investment) ||
    !isNonNegativeNumber(setup.trailingStopPercent) ||
    !isNonNegativeNumber(setup.gridCount)
  ) {
    return fallback(context);
  }

  return {
    state: record.state as AiSignalState,
    symbol: record.symbol,
    targetBotPair: record.targetBotPair,
    decision: record.decision as AiAnalysisResult['decision'],
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
    risk: record.risk as GridRisk,
    confidence: record.confidence,
    reasons: record.reasons.filter((item): item is string => typeof item === 'string'),
    warnings: record.warnings.filter((item): item is string => typeof item === 'string'),
    waitingFor: record.waitingFor.filter((item): item is string => typeof item === 'string')
  };
}
