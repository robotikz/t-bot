/**
 * Shared price formatting and precision utilities for market scanner and charts.
 */

export interface PricePrecisionConfig {
  precision: number;
  minMove: number;
}

/**
 * Derives precision (decimal places) and minMove step size from an instrument's tick size
 * or from a dynamic price inspection.
 */
export function getPricePrecisionConfig(
  referencePrice: number | null | undefined,
  tickSize?: string | number | null,
): PricePrecisionConfig {
  if (tickSize !== undefined && tickSize !== null) {
    const parsedTick = typeof tickSize === 'number' ? tickSize : parseFloat(tickSize);
    if (Number.isFinite(parsedTick) && parsedTick > 0) {
      const tickStr = parsedTick.toString();
      let precision = 2;
      if (tickStr.includes('e-')) {
        const parts = tickStr.split('e-');
        precision = parseInt(parts[1], 10);
      } else if (tickStr.includes('.')) {
        precision = tickStr.split('.')[1].length;
      } else {
        precision = 0;
      }
      return {
        precision: Math.min(Math.max(precision, 0), 10),
        minMove: parsedTick,
      };
    }
  }

  // Dynamic precision rule if tickSize is missing or not provided
  const precision = getDynamicPrecision(referencePrice);
  const minMove = Math.pow(10, -precision);
  return { precision, minMove };
}

/**
 * Dynamic precision rule based on price magnitude:
 * - >= 1000: 2 decimals (e.g. BTC 65,432.10)
 * - >= 1: 4 decimals (e.g. ADA 0.4500, ETH 3,210.50 -> handled by >= 1000)
 * - >= 0.01: 4 decimals (e.g. 0.1874)
 * - >= 0.0001: 6 decimals
 * - < 0.0001 down to tiny prices (e.g. PEPE ~ 0.00000442): 8 decimals
 *
 * Ensures at least 3-4 significant figures for small non-zero prices so values like
 * 0.00000442 are never truncated or rounded to 0.00.
 */
export function getDynamicPrecision(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return 2;
  }

  const abs = Math.abs(value);
  if (abs >= 1000) return 2;
  if (abs >= 1) return 4;
  if (abs >= 0.01) return 4;
  if (abs >= 0.0001) return 6;
  return 8;
}

/**
 * Format a numeric market price with precision awareness.
 * Suitable for both very small (e.g. 0.00000442) and large prices (e.g. 68500.25).
 * Never rounds small non-zero prices to 0.00.
 */
export function formatPrecisionPrice(
  value: number | null | undefined,
  precisionConfig?: PricePrecisionConfig | number,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  if (value === 0) {
    return '0.00';
  }

  let precision: number;
  if (typeof precisionConfig === 'number') {
    precision = precisionConfig;
  } else if (precisionConfig && typeof precisionConfig.precision === 'number') {
    precision = precisionConfig.precision;
  } else {
    precision = getDynamicPrecision(value);
  }

  precision = Math.min(Math.max(precision, 0), 10);

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    useGrouping: true,
  }).format(value);
}
