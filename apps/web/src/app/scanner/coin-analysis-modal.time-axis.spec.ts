import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { formatChartTimeAxisLabel } from './coin-analysis-modal.component';

describe('coin-analysis-modal time axis formatting', () => {
  it('formats intraday timestamps in UTC without shifting the candle time', () => {
    expect(formatChartTimeAxisLabel(Math.floor(Date.parse('2026-10-16T14:45:00.000Z') / 1000))).toBe('16 Oct 14:45');
    expect(formatChartTimeAxisLabel(Math.floor(Date.parse('2026-10-16T14:00:00.000Z') / 1000))).toBe('16 Oct 14:00');
    expect(formatChartTimeAxisLabel({ year: 2026, month: 10, day: 16 })).toBe('16 Oct 00:00');
  });
});
