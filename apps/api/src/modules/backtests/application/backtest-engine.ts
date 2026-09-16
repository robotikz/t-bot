import { Candle } from '../../brokers/domain/types.js';
import { Signal, SignalType } from '../../strategies/domain/signal.js';
import { StrategyRegistry } from '../../strategies/application/strategy-registry.service.js';
import {
  BacktestConfig,
  BacktestMetrics,
  BacktestResult,
  BacktestTrade,
  EquityPoint,
  SimulatedPosition,
} from '../domain/backtest.types.js';

type ExecuteSignalResult = {
  cash: number;
  position: SimulatedPosition | null;
  trade?: BacktestTrade;
};

export class BacktestEngine {
  constructor(private readonly strategyRegistry: StrategyRegistry) {}

  run(config: BacktestConfig, candles: Candle[]): BacktestResult {
    const sortedCandles = this.sortCandles(candles).filter((candle) => this.isWithinRange(candle, config));

    if (!sortedCandles.length) {
      return this.createEmptyResult(config);
    }

    const signals: Signal[] = [];
    const trades: BacktestTrade[] = [];
    const equityCurve: EquityPoint[] = [];
    const strategyParameters = config.strategyParameters ?? {};

    let cash = config.initialCapital;
    let position: SimulatedPosition | null = null;
    let pendingSignal: Signal | null = null;

    for (let index = 0; index < sortedCandles.length; index += 1) {
      const candle = sortedCandles[index];

      if (pendingSignal) {
        const execution = this.executePendingSignal(pendingSignal, candle, cash, position, config.feeRate);
        cash = execution.cash;
        position = execution.position;

        if (execution.trade) {
          trades.push(execution.trade);
        }

        pendingSignal = null;
      }

      const contextCandles = sortedCandles.slice(0, index + 1).map((currentCandle) => ({
        ...currentCandle,
        isClosed: true,
      }));

      const signal = this.strategyRegistry.evaluate(
        config.strategyId,
        {
          symbol: config.symbol,
          timeframe: config.timeframe,
          candles: contextCandles,
        },
        strategyParameters,
      );

      signals.push(signal);

      if (signal.type !== SignalType.HOLD) {
        pendingSignal = signal;
      }

      equityCurve.push({
        timestamp: candle.closeTime,
        equity: this.calculateEquity(cash, position, candle.close),
      });
    }

    if (position) {
      const finalCandle = sortedCandles.at(-1)!;
      const forcedExitTrade = this.closeOpenPosition(position, finalCandle, cash, config.feeRate);
      cash = forcedExitTrade.cash;
      if (forcedExitTrade.trade) {
        trades.push(forcedExitTrade.trade);
      }
      equityCurve[equityCurve.length - 1] = {
        timestamp: finalCandle.closeTime,
        equity: cash,
      };
    }

    return {
      config,
      trades,
      equityCurve,
      metrics: this.calculateMetrics(config.initialCapital, cash, trades, equityCurve),
      signals,
    };
  }

  private executePendingSignal(
    signal: Signal,
    candle: Candle,
    cash: number,
    position: SimulatedPosition | null,
    feeRate: number,
  ): ExecuteSignalResult {
    if (signal.type === SignalType.BUY) {
      if (position) {
        return { cash, position };
      }

      if (candle.open <= 0) {
        return { cash, position };
      }

      const notionalBeforeFees = cash / (1 + feeRate);
      const quantity = notionalBeforeFees / candle.open;
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { cash, position };
      }

      const entryFee = candle.open * quantity * feeRate;
      const totalCost = candle.open * quantity + entryFee;
      const remainingCash = cash - totalCost;

      if (remainingCash < -1e-8) {
        return { cash, position };
      }

      return {
        cash: Math.max(0, remainingCash),
        position: {
          side: 'LONG',
          quantity,
          entryPrice: candle.open,
          entryTime: candle.openTime,
          entryFee,
        },
      };
    }

    if (signal.type === SignalType.SELL) {
      if (!position) {
        return { cash, position };
      }

      return this.closePosition(position, candle, cash, feeRate);
    }

    return { cash, position };
  }

  private closePosition(
    position: SimulatedPosition,
    candle: Candle,
    cash: number,
    feeRate: number,
  ): ExecuteSignalResult {
    const exitPrice = candle.open;
    const exitFee = exitPrice * position.quantity * feeRate;
    const proceeds = exitPrice * position.quantity - exitFee;
    const grossPnl = (exitPrice - position.entryPrice) * position.quantity;
    const fees = position.entryFee + exitFee;
    const netPnl = grossPnl - fees;

    return {
      cash: cash + proceeds,
      position: null,
      trade: {
        entryTime: position.entryTime,
        exitTime: candle.openTime,
        entryPrice: position.entryPrice,
        exitPrice,
        quantity: position.quantity,
        grossPnl,
        fees,
        netPnl,
        returnPercent: position.entryPrice === 0 ? 0 : (netPnl / (position.entryPrice * position.quantity)) * 100,
      },
    };
  }

  private closeOpenPosition(position: SimulatedPosition, candle: Candle, cash: number, feeRate: number): ExecuteSignalResult {
    const exitPrice = candle.close;
    const exitFee = exitPrice * position.quantity * feeRate;
    const proceeds = exitPrice * position.quantity - exitFee;
    const grossPnl = (exitPrice - position.entryPrice) * position.quantity;
    const fees = position.entryFee + exitFee;
    const netPnl = grossPnl - fees;

    return {
      cash: cash + proceeds,
      position: null,
      trade: {
        entryTime: position.entryTime,
        exitTime: candle.closeTime,
        entryPrice: position.entryPrice,
        exitPrice,
        quantity: position.quantity,
        grossPnl,
        fees,
        netPnl,
        returnPercent: position.entryPrice === 0 ? 0 : (netPnl / (position.entryPrice * position.quantity)) * 100,
      },
    };
  }

  private calculateEquity(cash: number, position: SimulatedPosition | null, currentClose: number) {
    if (!position) {
      return cash;
    }

    return cash + position.quantity * currentClose;
  }

  private calculateMetrics(
    initialCapital: number,
    finalCapital: number,
    trades: BacktestTrade[],
    equityCurve: EquityPoint[],
  ): BacktestMetrics {
    const totalTrades = trades.length;
    const winningTrades = trades.filter((trade) => trade.netPnl > 0).length;
    const losingTrades = trades.filter((trade) => trade.netPnl < 0).length;
    const grossProfit = trades.filter((trade) => trade.grossPnl > 0).reduce((sum, trade) => sum + trade.grossPnl, 0);
    const grossLoss = trades.filter((trade) => trade.grossPnl < 0).reduce((sum, trade) => sum + trade.grossPnl, 0);
    const totalNetPnl = trades.reduce((sum, trade) => sum + trade.netPnl, 0);
    const averageTrade = totalTrades ? totalNetPnl / totalTrades : null;
    const winningNet = trades.filter((trade) => trade.netPnl > 0).reduce((sum, trade) => sum + trade.netPnl, 0);
    const losingNet = trades.filter((trade) => trade.netPnl < 0).reduce((sum, trade) => sum + trade.netPnl, 0);
    const averageWinningTrade = winningTrades ? winningNet / winningTrades : null;
    const averageLosingTrade = losingTrades ? losingNet / losingTrades : null;

    return {
      initialCapital,
      finalCapital,
      netProfit: finalCapital - initialCapital,
      netProfitPercent: initialCapital === 0 ? 0 : ((finalCapital - initialCapital) / initialCapital) * 100,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: totalTrades ? winningTrades / totalTrades : null,
      grossProfit,
      grossLoss,
      averageTrade,
      averageWinningTrade,
      averageLosingTrade,
      maxDrawdown: this.calculateMaxDrawdown(equityCurve),
    };
  }

  private calculateMaxDrawdown(equityCurve: EquityPoint[]) {
    let peak = equityCurve[0]?.equity ?? 0;
    let maxDrawdown = 0;

    for (const point of equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
      }

      if (peak > 0) {
        const drawdown = (peak - point.equity) / peak;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }

    return maxDrawdown;
  }

  private createEmptyResult(config: BacktestConfig): BacktestResult {
    return {
      config,
      trades: [],
      equityCurve: [],
      metrics: {
        initialCapital: config.initialCapital,
        finalCapital: config.initialCapital,
        netProfit: 0,
        netProfitPercent: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: null,
        grossProfit: 0,
        grossLoss: 0,
        averageTrade: null,
        averageWinningTrade: null,
        averageLosingTrade: null,
        maxDrawdown: 0,
      },
      signals: [],
    };
  }

  private sortCandles(candles: Candle[]) {
    return [...candles].sort((left, right) => left.openTime.getTime() - right.openTime.getTime());
  }

  private isWithinRange(candle: Candle, config: BacktestConfig) {
    return candle.openTime.getTime() >= config.startTime.getTime() && candle.openTime.getTime() <= config.endTime.getTime();
  }
}
