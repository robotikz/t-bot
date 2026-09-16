import { EmaIndicator } from './indicators/ema.indicator.js';
import { RsiIndicator } from './indicators/rsi.indicator.js';

export class IndicatorEngine {
  private readonly emaIndicator = new EmaIndicator();
  private readonly rsiIndicator = new RsiIndicator();

  ema(closes: number[], period: number): Array<number | null> {
    return this.emaIndicator.calculate({ closes, period });
  }

  rsi(closes: number[], period: number): Array<number | null> {
    return this.rsiIndicator.calculate({ closes, period });
  }
}
