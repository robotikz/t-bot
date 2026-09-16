import { InvalidIndicatorInputException } from '../../application/errors/invalid-indicator-input.exception.js';
import { Indicator } from '../indicator.js';

export type RsiInput = {
  closes: number[];
  period: number;
};

export class RsiIndicator implements Indicator<RsiInput, Array<number | null>> {
  readonly name = 'RSI';

  calculate(input: RsiInput): Array<number | null> {
    const { closes, period } = input;

    if (!Number.isInteger(period) || period <= 0) {
      throw new InvalidIndicatorInputException('RSI period must be a positive integer');
    }

    if (closes.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new InvalidIndicatorInputException('RSI closes must contain finite non-negative numbers');
    }

    if (closes.length === 0) {
      return [];
    }

    const rsiValues: Array<number | null> = Array.from({ length: closes.length }, () => null);
    if (closes.length <= period) {
      return rsiValues;
    }

    let averageGain = 0;
    let averageLoss = 0;

    for (let index = 1; index <= period; index += 1) {
      const change = closes[index] - closes[index - 1];
      averageGain += Math.max(change, 0);
      averageLoss += Math.max(-change, 0);
    }

    averageGain /= period;
    averageLoss /= period;
    rsiValues[period] = this.toRsi(averageGain, averageLoss);

    for (let index = period + 1; index < closes.length; index += 1) {
      const change = closes[index] - closes[index - 1];
      const gain = Math.max(change, 0);
      const loss = Math.max(-change, 0);

      averageGain = ((averageGain * (period - 1)) + gain) / period;
      averageLoss = ((averageLoss * (period - 1)) + loss) / period;
      rsiValues[index] = this.toRsi(averageGain, averageLoss);
    }

    return rsiValues;
  }

  private toRsi(averageGain: number, averageLoss: number): number {
    if (averageLoss === 0 && averageGain === 0) {
      return 50;
    }

    if (averageLoss === 0) {
      return 100;
    }

    if (averageGain === 0) {
      return 0;
    }

    const relativeStrength = averageGain / averageLoss;
    return 100 - (100 / (1 + relativeStrength));
  }
}
