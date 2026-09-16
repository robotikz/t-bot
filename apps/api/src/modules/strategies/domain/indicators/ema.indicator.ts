import { InvalidIndicatorInputException } from '../../application/errors/invalid-indicator-input.exception.js';
import { Indicator } from '../indicator.js';

export type EmaInput = {
  closes: number[];
  period: number;
};

export class EmaIndicator implements Indicator<EmaInput, Array<number | null>> {
  readonly name = 'EMA';

  calculate(input: EmaInput): Array<number | null> {
    const { closes, period } = input;

    if (!Number.isInteger(period) || period <= 0) {
      throw new InvalidIndicatorInputException('EMA period must be a positive integer');
    }

    if (closes.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new InvalidIndicatorInputException('EMA closes must contain finite non-negative numbers');
    }

    if (closes.length === 0) {
      return [];
    }

    const emaValues: Array<number | null> = Array.from({ length: closes.length }, () => null);
    if (closes.length < period) {
      return emaValues;
    }

    const smoothing = 2 / (period + 1);
    const initialSlice = closes.slice(0, period);
    let ema = initialSlice.reduce((accumulator, value) => accumulator + value, 0) / period;
    emaValues[period - 1] = ema;

    for (let index = period; index < closes.length; index += 1) {
      ema = (closes[index] * smoothing) + (ema * (1 - smoothing));
      emaValues[index] = ema;
    }

    return emaValues;
  }
}
