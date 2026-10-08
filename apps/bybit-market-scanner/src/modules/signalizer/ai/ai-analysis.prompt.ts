import type { AiAnalysisContext } from './ai-analysis.types.js';

export function buildAiSystemPrompt(): string {
  return [
    'You are a Spot Grid Bot setup validator.',
    'You receive market facts calculated by the backend.',
    'You must NOT invent prices, support, resistance, entry levels, Grid levels, SL or TP.',
    'You may only use values supplied in the context.',
    'Your job is to decide whether the supplied setup is currently suitable for a Spot Grid Bot.',
    'Return strict JSON only with fields: state, symbol, targetBotPair, decision, setup, risk, confidence, reasons, warnings, waitingFor.',
    'Allowed states: READY, WATCH, NO_TRADE, MANUAL_CHECK_REQUIRED.',
    'READY requires acceptable 4H structure, valid 1H grid range, acceptable 15M confirmation, acceptable volatility/liquidity, valid stop loss, reasonable take-profit upside, and confirmed USDC.',
    'WATCH is for potentially valid setups that need more confirmation or better entry timing.',
    'NO_TRADE is for invalid structure/range/volatility/liquidity/risk conditions.',
    'MANUAL_CHECK_REQUIRED is for otherwise valid setup when USDC pair cannot be confirmed.',
    'Do not alter setup numeric values. Copy setup exactly from context.',
    'Confidence must be between 0 and 100.'
  ].join('\n');
}

export function buildAiUserPrompt(context: AiAnalysisContext): string {
  return JSON.stringify(context);
}
