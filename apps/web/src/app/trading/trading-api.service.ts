import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

const API_BASE_URL = 'http://localhost:3000/api';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface TradingBroker {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
}

export interface TradingStrategy {
  id: string;
  name: string;
  description?: string | null;
}

export interface TradingMarket {
  symbol: string;
  baseAsset?: string;
  quoteAsset?: string;
  active?: boolean;
}

export interface TradingCandle {
  brokerId?: string;
  symbol: string;
  timeframe: string;
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed?: boolean;
}

export interface TradingSignal {
  strategyId: string;
  symbol: string;
  timeframe: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  timestamp: string;
  price?: number;
  reason: string;
  indicators?: Record<string, number | null>;
}

export interface TradingTrade {
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

export interface TradingEquityPoint {
  timestamp: Date;
  equity: number;
}

export interface TradingBacktestMetrics {
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

export interface TradingBacktestResult {
  config: {
    brokerId: string;
    symbol: string;
    timeframe: string;
    strategyId: string;
    startTime: string;
    endTime: string;
    initialCapital: number;
    feeRate: number;
    strategyParameters?: Record<string, number | string | boolean | null | undefined>;
  };
  trades: TradingTrade[];
  equityCurve: TradingEquityPoint[];
  metrics: TradingBacktestMetrics;
  signals: TradingSignal[];
}

export interface BacktestRequest {
  broker: string;
  symbol: string;
  timeframe: string;
  strategyId: string;
  startTime: string;
  endTime: string;
  initialCapital: number;
  feeRate: number;
  strategyParameters?: Record<string, number | string | boolean | null | undefined>;
}

@Injectable({ providedIn: 'root' })
export class TradingApiService {
  constructor(private readonly http: HttpClient) {}

  getBrokers(): Observable<TradingBroker[]> {
    return this.http.get<ApiEnvelope<TradingBroker[]>>(`${API_BASE_URL}/brokers`).pipe(map((response) => response.data));
  }

  getStrategies(): Observable<TradingStrategy[]> {
    return this.http.get<ApiEnvelope<TradingStrategy[]>>(`${API_BASE_URL}/strategies`).pipe(map((response) => response.data));
  }

  getMarkets(broker: string): Observable<TradingMarket[]> {
    const params = new HttpParams().set('broker', broker);
    return this.http.get<ApiEnvelope<TradingMarket[]>>(`${API_BASE_URL}/market-data/markets`, { params }).pipe(map((response) => response.data));
  }

  getCandles(request: { broker: string; symbol: string; timeframe: string; startTime: string; endTime: string }): Observable<TradingCandle[]> {
    const params = new HttpParams()
      .set('broker', request.broker)
      .set('symbol', request.symbol)
      .set('timeframe', request.timeframe)
      .set('startTime', request.startTime)
      .set('endTime', request.endTime);

    return this.http.get<ApiEnvelope<TradingCandle[]>>(`${API_BASE_URL}/market-data/candles`, { params }).pipe(map((response) => response.data));
  }

  runBacktest(request: BacktestRequest): Observable<TradingBacktestResult> {
    return this.http.post<ApiEnvelope<TradingBacktestResult>>(`${API_BASE_URL}/backtests`, request).pipe(
      map((response) => this.normalizeBacktestResult(response.data)),
    );
  }

  private normalizeBacktestResult(result: TradingBacktestResult): TradingBacktestResult {
    return {
      ...result,
      trades: result.trades.map((trade) => ({
        ...trade,
        entryTime: new Date(trade.entryTime),
        exitTime: new Date(trade.exitTime),
      })),
      equityCurve: result.equityCurve.map((point) => ({
        ...point,
        timestamp: new Date(point.timestamp),
      })),
      signals: result.signals.map((signal) => ({
        ...signal,
        timestamp: new Date(signal.timestamp).toISOString(),
      })),
      config: {
        ...result.config,
        startTime: new Date(result.config.startTime).toISOString(),
        endTime: new Date(result.config.endTime).toISOString(),
      },
    };
  }
}
