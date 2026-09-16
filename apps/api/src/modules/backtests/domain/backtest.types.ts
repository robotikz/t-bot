import { Candle, Timeframe } from '../../brokers/domain/types.js';
import { Signal } from '../../strategies/domain/signal.js';

export interface BacktestConfig {
  brokerId: string;
  symbol: string;
  timeframe: Timeframe;
  strategyId: string;
  startTime: Date;
  endTime: Date;
  initialCapital: number;
  feeRate: number;
  strategyParameters?: Record<string, number | string | boolean | null | undefined>;
}

export interface SimulatedPosition {
  side: 'LONG';
  quantity: number;
  entryPrice: number;
  entryTime: Date;
  entryFee: number;
}

export interface BacktestTrade {
  entryTime: Date;
  exitTime: Date;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnl: number;
  fees: number;
  netPnl: number;
  returnPercent: number;
}

export interface EquityPoint {
  timestamp: Date;
  equity: number;
}

export interface BacktestMetrics {
  initialCapital: number;
  finalCapital: number;
  netProfit: number;
  netProfitPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  grossProfit: number;
  grossLoss: number;
  averageTrade: number | null;
  averageWinningTrade: number | null;
  averageLosingTrade: number | null;
  maxDrawdown: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  metrics: BacktestMetrics;
  signals: Signal[];
}

export type BacktestCandle = Candle;
