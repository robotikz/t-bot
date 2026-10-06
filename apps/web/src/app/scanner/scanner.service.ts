import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

const API_BASE_URL = '/api';

interface ApiEnvelope<T> {
  data: T;
}

export type ScannerTimeframe = '15m' | '1h';
export type CandidateStatus = 'CANDIDATE' | 'WATCH' | 'REJECTED';
export type TrendDirection = 'UP' | 'DOWN' | 'SIDEWAYS';

export interface MarketTicker {
  symbol: string;
  lastPrice: number;
  change24hPercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  turnover24h: number;
  bidPrice?: number;
  askPrice?: number;
  timestamp: number;
}

export interface MarketAnalysis {
  symbol: string;
  price: number;
  change24hPercent: number;
  volume24h: number;
  turnover24h: number;
  timeframe: ScannerTimeframe;
  rangeHigh: number;
  rangeLow: number;
  rangePercent: number;
  support: number;
  resistance: number;
  distanceToSupportPercent: number;
  distanceToResistancePercent: number;
  positionInRangePercent: number;
  volatilityPercent: number;
  trendDirection: TrendDirection;
  trendStrength: number;
  liquidityScore: number;
  gridScore: number;
  rejectionReasons: string[];
}

export interface ScannerCandidate {
  symbol: string;
  score: number;
  status: CandidateStatus;
  market: MarketTicker;
  analysis15m?: MarketAnalysis;
  analysis1h?: MarketAnalysis;
  reasons: string[];
  rejectionReasons: string[];
}

export interface ScanResult {
  timestamp: string;
  count: number;
  candidates: ScannerCandidate[];
}

export interface QuoteCoinsResult {
  count: number;
  data: string[];
}

export interface MarketsResult {
  count: number;
  data: MarketInstrument[];
}

export interface MarketInstrument {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  status: string;
}

export interface ScannerQuery {
  timeframe?: ScannerTimeframe;
  secondaryTimeframe?: ScannerTimeframe;
  limit?: number;
  minTurnover?: number;
  quoteCoin?: string;
}

@Injectable({ providedIn: 'root' })
export class ScannerService {
  constructor(private readonly http: HttpClient) {}

  getQuoteCoins(): Observable<string[]> {
    return this.http
      .get<QuoteCoinsResult | ApiEnvelope<QuoteCoinsResult>>(`${API_BASE_URL}/markets/quote-coins`)
      .pipe(
        tap((response) => console.log('[scanner-service] quoteCoins response', response)),
        map((response) => {
          if (Array.isArray((response as QuoteCoinsResult)?.data)) {
            return (response as QuoteCoinsResult).data;
          }

          const nestedData = (response as ApiEnvelope<QuoteCoinsResult>)?.data?.data;
          return Array.isArray(nestedData) ? nestedData : [];
        }),
        tap((quoteCoins) => console.log('[scanner-service] quoteCoins data', quoteCoins)),
      );
  }

  scan(query: ScannerQuery = {}): Observable<ScanResult> {
    let params = new HttpParams();

    params = params.set('timeframe', query.timeframe ?? '1h');
    params = params.set('secondaryTimeframe', query.secondaryTimeframe ?? '15m');
    params = params.set('limit', String(query.limit ?? 10));
    params = params.set('quoteCoin', (query.quoteCoin ?? 'USDT').toUpperCase());

    if (query.minTurnover !== undefined && query.minTurnover !== null) {
      params = params.set('minTurnover', String(query.minTurnover));
    }

    return this.http.get<ApiEnvelope<ScanResult>>(`${API_BASE_URL}/scanner`, { params }).pipe(map((response) => response.data));
  }

  getMarketsByQuoteCoin(quoteCoin: string): Observable<MarketInstrument[]> {
    const params = new HttpParams().set('quoteCoin', quoteCoin.toUpperCase());

    return this.http
      .get<MarketsResult | ApiEnvelope<MarketsResult>>(`${API_BASE_URL}/markets`, { params })
      .pipe(
        map((response) => {
          if (Array.isArray((response as MarketsResult)?.data)) {
            return (response as MarketsResult).data;
          }

          const nestedData = (response as ApiEnvelope<MarketsResult>)?.data?.data;
          return Array.isArray(nestedData) ? nestedData : [];
        }),
      );
  }

  getAnalysis(symbol: string, timeframe: ScannerTimeframe): Observable<MarketAnalysis> {
    const params = new HttpParams().set('timeframe', timeframe);

    return this.http
      .get<ApiEnvelope<MarketAnalysis>>(`${API_BASE_URL}/analysis/${symbol.toUpperCase()}`, { params })
      .pipe(map((response) => response.data));
  }
}
