import { Timeframe } from '../../brokers/domain/types.js';

export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
}

export interface Signal {
  strategyId: string;
  symbol: string;
  timeframe: Timeframe;
  type: SignalType;
  timestamp: Date;
  price?: number;
  reason: string;
  indicators?: Record<string, number | null>;
}
