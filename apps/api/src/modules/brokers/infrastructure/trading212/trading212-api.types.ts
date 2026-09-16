export interface Trading212CashResponse {
  availableToTrade: number;
  inPies?: number;
  reservedForOrders?: number;
}

export interface Trading212InvestmentsResponse {
  currentValue?: number;
  realizedProfitLoss?: number;
  totalCost?: number;
  unrealizedProfitLoss?: number;
}

export interface Trading212AccountSummaryResponse {
  id: number;
  currency: string;
  cash: Trading212CashResponse;
  investments?: Trading212InvestmentsResponse;
  totalValue?: number;
}

export interface Trading212InstrumentResponse {
  ticker: string;
  name?: string;
  shortName?: string;
  currencyCode?: string;
  isin?: string;
  type?: string;
  workingScheduleId?: number;
  extendedHours?: boolean;
  addedOn?: string;
  maxOpenQuantity?: number;
}

export interface Trading212PositionWalletImpactResponse {
  currency?: string;
  currentValue?: number;
  fxImpact?: number;
  totalCost?: number;
  unrealizedProfitLoss?: number;
}

export interface Trading212PositionResponse {
  averagePricePaid?: number;
  createdAt?: string;
  currentPrice?: number;
  instrument: Trading212InstrumentResponse;
  quantity: number;
  quantityAvailableForTrading?: number;
  quantityInPies?: number;
  walletImpact?: Trading212PositionWalletImpactResponse;
}

export interface Trading212PaginatedResponse<T> {
  items: T[];
  nextPagePath?: string | null;
}