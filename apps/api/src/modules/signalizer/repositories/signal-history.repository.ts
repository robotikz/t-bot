export interface SignalObservationRecord {
  id: string;
  symbol: string;
  sourceSymbol: string;
  targetSymbol: string;
  observedAt: Date;
  previousState?: string | null;
  currentState: string;
  confidence?: number | null;
  risk?: string | null;
  setupSnapshot: any;
  aiDecision?: string | null;
  reasons: any;
  rejections: any;
  usdcAvailable: boolean;
  pairValidation: any;
  currentPrice: number;
  timeframeInfo: any;
  createdAt: Date;
}

export interface SignalHistoryRepository {
  create(record: Partial<SignalObservationRecord>): Promise<SignalObservationRecord>;
  findLatestBySymbol(symbol: string): Promise<SignalObservationRecord | null>;
  find(filter: { symbol?: string; state?: string; from?: Date; to?: Date; limit?: number }): Promise<SignalObservationRecord[]>;
}
