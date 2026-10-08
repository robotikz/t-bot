import type { RiskEvaluation, RiskInput } from './grid-setup.types.js';

export function calculateRisk(input: RiskInput): RiskEvaluation {
  let score = 0;

  if (input.distanceToInvalidationPercent < 1.2) score += 3;
  else if (input.distanceToInvalidationPercent < 2.2) score += 2;
  else if (input.distanceToInvalidationPercent < 3) score += 1;

  if (input.distanceToResistancePercent < 1.8) score += 2;
  else if (input.distanceToResistancePercent < 2.8) score += 1;

  if (input.volatilityPercent > 4) score += 2;
  else if (input.volatilityPercent > 2.5) score += 1;

  if (input.rangePercent > 18) score += 2;
  else if (input.rangePercent > 12) score += 1;

  if (!input.trendAligned) score += 2;
  if (!input.entryConfirmed) score += 2;

  if (input.turnover24h < 3_000_000) score += 2;
  else if (input.turnover24h < 8_000_000) score += 1;

  if (score <= 3) {
    return { risk: 'LOW', score };
  }

  if (score <= 7) {
    return { risk: 'MEDIUM', score };
  }

  return { risk: 'HIGH', score };
}
