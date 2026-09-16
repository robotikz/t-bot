import { Signal, SignalType } from '../signal.js';
import { StrategyContext } from '../strategy-context.js';
import { Strategy } from '../strategy.js';
import { IndicatorEngine } from '../indicator-engine.js';
import { getClosedCandles } from '../closed-candles.js';

const DEFAULT_FAST_PERIOD = 9;
const DEFAULT_SLOW_PERIOD = 21;

export class EmaCrossoverStrategy implements Strategy {
  readonly id = 'ema-crossover';
  readonly name = 'EMA Crossover';
  readonly description = 'Generates signals from fast/slow EMA crossovers';

  constructor(
    private readonly indicatorEngine: IndicatorEngine,
    private readonly fastPeriod = DEFAULT_FAST_PERIOD,
    private readonly slowPeriod = DEFAULT_SLOW_PERIOD,
  ) {}

  evaluate(context: StrategyContext): Signal {
    const closedCandles = getClosedCandles(context.candles);
    const latestClosedCandle = closedCandles.at(-1);

    if (!latestClosedCandle) {
      return {
        strategyId: this.id,
        symbol: context.symbol,
        timeframe: context.timeframe,
        type: SignalType.HOLD,
        timestamp: new Date(),
        reason: 'No closed candles available',
      };
    }

    if (closedCandles.length < this.slowPeriod + 1) {
      return {
        strategyId: this.id,
        symbol: context.symbol,
        timeframe: context.timeframe,
        type: SignalType.HOLD,
        timestamp: latestClosedCandle.closeTime,
        price: latestClosedCandle.close,
        reason: `Insufficient closed candles for EMA(${this.fastPeriod})/EMA(${this.slowPeriod}) crossover`,
        indicators: {
          emaFast: null,
          emaSlow: null,
        },
      };
    }

    const closes = closedCandles.map((candle) => candle.close);
    const fastEma = this.indicatorEngine.ema(closes, this.fastPeriod);
    const slowEma = this.indicatorEngine.ema(closes, this.slowPeriod);

    const currentIndex = closes.length - 1;
    const previousIndex = currentIndex - 1;

    const currentFast = fastEma[currentIndex];
    const currentSlow = slowEma[currentIndex];
    const previousFast = fastEma[previousIndex];
    const previousSlow = slowEma[previousIndex];

    if (
      currentFast === null
      || currentSlow === null
      || previousFast === null
      || previousSlow === null
    ) {
      return {
        strategyId: this.id,
        symbol: context.symbol,
        timeframe: context.timeframe,
        type: SignalType.HOLD,
        timestamp: latestClosedCandle.closeTime,
        price: latestClosedCandle.close,
        reason: 'EMA values are not available for crossover evaluation yet',
        indicators: {
          emaFast: currentFast,
          emaSlow: currentSlow,
        },
      };
    }

    let signalType = SignalType.HOLD;
    let reason = 'No EMA crossover detected';

    if (previousFast <= previousSlow && currentFast > currentSlow) {
      signalType = SignalType.BUY;
      reason = 'Fast EMA crossed above slow EMA';
    } else if (previousFast >= previousSlow && currentFast < currentSlow) {
      signalType = SignalType.SELL;
      reason = 'Fast EMA crossed below slow EMA';
    }

    return {
      strategyId: this.id,
      symbol: context.symbol,
      timeframe: context.timeframe,
      type: signalType,
      timestamp: latestClosedCandle.closeTime,
      price: latestClosedCandle.close,
      reason,
      indicators: {
        emaFast: currentFast,
        emaSlow: currentSlow,
      },
    };
  }
}
