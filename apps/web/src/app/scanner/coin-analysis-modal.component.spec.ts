import { describe, expect, it } from 'vitest';
import { formatAdaptiveMarketPrice, formatAnalysisRange } from './coin-analysis-modal.component';

describe('coin-analysis-modal formatting', () => {
  it('preserves tiny prices with adaptive precision', () => {
    expect(formatAdaptiveMarketPrice(0.000004095)).toBe('0.00000410');
    expect(formatAdaptiveMarketPrice(0.000004)).toBe('0.00000400');
  });

  it('formats the range with the same precision policy', () => {
    expect(formatAnalysisRange(0.00000401, 0.0000043)).toBe('0.00000401 - 0.00000430');
    expect(formatAnalysisRange(undefined, 0.0000043)).toBe('N/A');
  });
});
