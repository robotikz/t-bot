import { describe, expect, it } from 'vitest';
import {
  formatPrecisionPrice,
  getDynamicPrecision,
  getPricePrecisionConfig,
} from './price-formatter.utils';

describe('price-formatter.utils', () => {
  describe('getDynamicPrecision', () => {
    it('returns 2 decimals for large prices (>= 1000)', () => {
      expect(getDynamicPrecision(65432.1)).toBe(2);
      expect(getDynamicPrecision(1000)).toBe(2);
    });

    it('returns 4 decimals for standard prices (>= 1)', () => {
      expect(getDynamicPrecision(999.99)).toBe(4);
      expect(getDynamicPrecision(1.2345)).toBe(4);
      expect(getDynamicPrecision(1)).toBe(4);
    });

    it('returns 4 decimals for sub-dollar prices (>= 0.01)', () => {
      expect(getDynamicPrecision(0.1874)).toBe(4);
      expect(getDynamicPrecision(0.05432)).toBe(4);
      expect(getDynamicPrecision(0.01)).toBe(4);
    });

    it('returns 6 decimals for micro prices (>= 0.0001)', () => {
      expect(getDynamicPrecision(0.005)).toBe(6);
      expect(getDynamicPrecision(0.000123)).toBe(6);
      expect(getDynamicPrecision(0.0001)).toBe(6);
    });

    it('returns 8 decimals for tiny prices like PEPEUSDC (< 0.0001)', () => {
      expect(getDynamicPrecision(0.00000442)).toBe(8);
      expect(getDynamicPrecision(0.00000012)).toBe(8);
    });

    it('handles null, undefined, NaN, and negative numbers with fallback', () => {
      expect(getDynamicPrecision(null)).toBe(2);
      expect(getDynamicPrecision(undefined)).toBe(2);
      expect(getDynamicPrecision(NaN)).toBe(2);
      expect(getDynamicPrecision(-5)).toBe(2);
      expect(getDynamicPrecision(0)).toBe(2);
    });
  });

  describe('getPricePrecisionConfig', () => {
    it('uses exchange tickSize if provided', () => {
      const cfgFromDecimal = getPricePrecisionConfig(0.00000442, '0.00000001');
      expect(cfgFromDecimal.precision).toBe(8);
      expect(cfgFromDecimal.minMove).toBe(0.00000001);

      const cfgFromNumber = getPricePrecisionConfig(0.1874, 0.0001);
      expect(cfgFromNumber.precision).toBe(4);
      expect(cfgFromNumber.minMove).toBe(0.0001);

      const cfgFromSci = getPricePrecisionConfig(0.00000442, '1e-8');
      expect(cfgFromSci.precision).toBe(8);
      expect(cfgFromSci.minMove).toBe(1e-8);
    });

    it('falls back to dynamic precision when tickSize is omitted or null', () => {
      const cfgPepe = getPricePrecisionConfig(0.00000442);
      expect(cfgPepe.precision).toBe(8);
      expect(cfgPepe.minMove).toBe(0.00000001);

      const cfgBtc = getPricePrecisionConfig(67000);
      expect(cfgBtc.precision).toBe(2);
      expect(cfgBtc.minMove).toBe(0.01);
    });
  });

  describe('formatPrecisionPrice', () => {
    it('never rounds tiny prices like PEPEUSDC (0.00000442) to 0.00', () => {
      const formatted = formatPrecisionPrice(0.00000442);
      expect(formatted).toBe('0.00000442');
      expect(formatted).not.toBe('0.00');
    });

    it('preserves small non-zero values with dynamic precision', () => {
      expect(formatPrecisionPrice(0.000004095)).toBe('0.00000410');
      expect(formatPrecisionPrice(0.000004)).toBe('0.00000400');
      expect(formatPrecisionPrice(0.000123)).toBe('0.000123');
      expect(formatPrecisionPrice(0.1874)).toBe('0.1874');
    });

    it('formats large values with grouping and 2 decimal places', () => {
      expect(formatPrecisionPrice(65432.1)).toBe('65,432.10');
      expect(formatPrecisionPrice(1234.5678)).toBe('1,234.57');
    });

    it('formats using explicit PricePrecisionConfig or number precision', () => {
      expect(formatPrecisionPrice(0.00000442, { precision: 8, minMove: 0.00000001 })).toBe('0.00000442');
      expect(formatPrecisionPrice(12.3456, 3)).toBe('12.346');
    });

    it('handles null, undefined, and non-finite inputs cleanly', () => {
      expect(formatPrecisionPrice(null)).toBe('N/A');
      expect(formatPrecisionPrice(undefined)).toBe('N/A');
      expect(formatPrecisionPrice(NaN)).toBe('N/A');
      expect(formatPrecisionPrice(0)).toBe('0.00');
    });
  });
});
