import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

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

export interface ScannerQuery {
  timeframe?: ScannerTimeframe;
  secondaryTimeframe?: ScannerTimeframe;
  limit?: number;
  minTurnover?: number;
}

@Injectable({ providedIn: 'root' })
export class ScannerService {
  constructor(private readonly http: HttpClient) {}

  scan(query: ScannerQuery = {}): Observable<ScanResult> {
    let params = new HttpParams();

    params = params.set('timeframe', query.timeframe ?? '1h');
    params = params.set('secondaryTimeframe', query.secondaryTimeframe ?? '15m');
    params = params.set('limit', String(query.limit ?? 10));

    if (query.minTurnover !== undefined && query.minTurnover !== null) {
      params = params.set('minTurnover', String(query.minTurnover));
    }

    return this.http.get<ApiEnvelope<ScanResult>>(`${API_BASE_URL}/scanner`, { params }).pipe(map((response) => response.data));
  }
}
