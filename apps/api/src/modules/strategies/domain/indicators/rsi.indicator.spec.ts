import { describe, expect, it } from 'vitest';
import { InvalidIndicatorInputException } from '../../application/errors/invalid-indicator-input.exception.js';
import { RsiIndicator } from './rsi.indicator.js';

describe('RsiIndicator', () => {
  it('calculates RSI values aligned to input length', () => {
    const indicator = new RsiIndicator();

    const result = indicator.calculate({
      closes: [1, 2, 3, 2, 1],
      period: 3,
    });

    expect(result).toHaveLength(5);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeNull();
    expect(result[3]).toBeCloseTo(66.6666667, 5);
    expect(result[4]).toBeCloseTo(44.4444444, 5);
  });

  it('returns null values for insufficient input', () => {
    const indicator = new RsiIndicator();

    const result = indicator.calculate({ closes: [100, 102, 103], period: 3 });

    expect(result).toEqual([null, null, null]);
  });

  it('throws for invalid period', () => {
    const indicator = new RsiIndicator();

    expect(() => indicator.calculate({ closes: [1, 2, 3], period: -1 })).toThrow(InvalidIndicatorInputException);
    expect(() => indicator.calculate({ closes: [1, 2, 3], period: 1.2 })).toThrow(InvalidIndicatorInputException);
  });

  it('returns 100 for consistently increasing prices', () => {
    const indicator = new RsiIndicator();

    const result = indicator.calculate({ closes: [1, 2, 3, 4, 5, 6], period: 3 });

    expect(result[3]).toBe(100);
    expect(result[4]).toBe(100);
    expect(result[5]).toBe(100);
  });

  it('returns 0 for consistently decreasing prices', () => {
    const indicator = new RsiIndicator();

    const result = indicator.calculate({ closes: [6, 5, 4, 3, 2, 1], period: 3 });

    expect(result[3]).toBe(0);
    expect(result[4]).toBe(0);
    expect(result[5]).toBe(0);
  });

  it('produces mixed-range RSI values for mixed prices', () => {
    const indicator = new RsiIndicator();

    const result = indicator.calculate({ closes: [100, 101, 99, 102, 98, 103], period: 3 });

    expect(result[3]).not.toBeNull();
    expect(result[4]).not.toBeNull();
    expect(result[5]).not.toBeNull();
    expect((result[5] as number) > 0).toBe(true);
    expect((result[5] as number) < 100).toBe(true);
  });

  it('is deterministic for same input', () => {
    const indicator = new RsiIndicator();
    const input = { closes: [100, 98, 101, 99, 105, 103, 106], period: 4 };

    const first = indicator.calculate(input);
    const second = indicator.calculate(input);

    expect(first).toEqual(second);
  });
});
