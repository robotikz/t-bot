import { describe, expect, it } from 'vitest';
import { InvalidIndicatorInputException } from '../../application/errors/invalid-indicator-input.exception.js';
import { EmaIndicator } from './ema.indicator.js';

describe('EmaIndicator', () => {
  it('calculates EMA values aligned to input length', () => {
    const indicator = new EmaIndicator();

    const result = indicator.calculate({
      closes: [1, 2, 3, 4, 5],
      period: 3,
    });

    expect(result).toHaveLength(5);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(2);
    expect(result[3]).toBe(3);
    expect(result[4]).toBe(4);
  });

  it('returns null values for insufficient input', () => {
    const indicator = new EmaIndicator();

    const result = indicator.calculate({
      closes: [100, 101],
      period: 3,
    });

    expect(result).toEqual([null, null]);
  });

  it('throws for invalid period', () => {
    const indicator = new EmaIndicator();

    expect(() => indicator.calculate({ closes: [1, 2, 3], period: 0 })).toThrow(InvalidIndicatorInputException);
    expect(() => indicator.calculate({ closes: [1, 2, 3], period: 2.5 })).toThrow(InvalidIndicatorInputException);
  });

  it('is deterministic for same input', () => {
    const indicator = new EmaIndicator();
    const input = { closes: [10, 11, 12, 13, 14, 15], period: 4 };

    const first = indicator.calculate(input);
    const second = indicator.calculate(input);

    expect(first).toEqual(second);
  });

  it('matches known expected values for period 3', () => {
    const indicator = new EmaIndicator();

    const result = indicator.calculate({
      closes: [10, 11, 12, 13, 14],
      period: 3,
    });

    expect(result[2]).toBeCloseTo(11, 8);
    expect(result[3]).toBeCloseTo(12, 8);
    expect(result[4]).toBeCloseTo(13, 8);
  });
});
