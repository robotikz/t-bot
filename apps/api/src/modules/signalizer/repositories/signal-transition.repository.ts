export interface SignalTransitionRecord {
  id: string;
  symbol: string;
  fromState?: string | null;
  toState: string;
  observedAt: Date;
  observationId: string;
  createdAt: Date;
}

export interface SignalTransitionRepository {
  create(record: Partial<SignalTransitionRecord>): Promise<SignalTransitionRecord>;
  findLatestBySymbol(symbol: string): Promise<SignalTransitionRecord | null>;
  find(filter: { symbol?: string; from?: string; to?: string }): Promise<SignalTransitionRecord[]>;
}
