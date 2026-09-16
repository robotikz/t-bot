import { Signal, SignalType } from '../signal.js';
import { StrategyContext } from '../strategy-context.js';
import { Strategy } from '../strategy.js';
import { IndicatorEngine } from '../indicator-engine.js';
import { getClosedCandles } from '../closed-candles.js';

const DEFAULT_PERIOD = 14;
const DEFAULT_OVERSOLD = 30;
const DEFAULT_OVERBOUGHT = 70;

export class RsiStrategy implements Strategy {
  readonly id = 'rsi';
  readonly name = 'RSI';
  readonly description = 'Generates signals from RSI overbought/oversold levels';

  constructor(
    private readonly indicatorEngine: IndicatorEngine,
    private readonly period = DEFAULT_PERIOD,
    private readonly oversold = DEFAULT_OVERSOLD,
    private readonly overbought = DEFAULT_OVERBOUGHT,
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

    const closes = closedCandles.map((candle) => candle.close);
    const rsiValues = this.indicatorEngine.rsi(closes, this.period);
    const currentRsi = rsiValues.at(-1) ?? null;

    if (currentRsi === null) {
      return {
        strategyId: this.id,
        symbol: context.symbol,
        timeframe: context.timeframe,
        type: SignalType.HOLD,
        timestamp: latestClosedCandle.closeTime,
        price: latestClosedCandle.close,
        reason: `Insufficient closed candles for RSI(${this.period})`,
        indicators: {
          rsi: null,
        },
      };
    }

    let signalType = SignalType.HOLD;
    let reason = 'RSI is in the neutral range';

    if (currentRsi <= this.oversold) {
      signalType = SignalType.BUY;
      reason = 'RSI is at or below the oversold threshold';
    } else if (currentRsi >= this.overbought) {
      signalType = SignalType.SELL;
      reason = 'RSI is at or above the overbought threshold';
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
        rsi: currentRsi,
      },
    };
  }
}
