export interface BybitApiEnvelope<T> {
  retCode: number;
  retMsg: string;
  result: T;
  retExtInfo?: Record<string, unknown>;
  time?: number;
}

export interface BybitInstrumentPriceFilter {
  minPrice?: string;
  maxPrice?: string;
  tickSize?: string;
}

export interface BybitInstrumentLotSizeFilter {
  minOrderQty?: string;
  maxOrderQty?: string;
  maxMktOrderQty?: string;
  qtyStep?: string;
  minNotionalValue?: string;
}

export interface BybitSpotInstrument {
  symbol: string;
  baseCoin?: string;
  quoteCoin?: string;
  status?: string;
  priceFilter?: BybitInstrumentPriceFilter;
  lotSizeFilter?: BybitInstrumentLotSizeFilter;
}

export interface BybitInstrumentsInfoResult {
  category: string;
  list: BybitSpotInstrument[];
  nextPageCursor?: string;
}

export type BybitKlineTuple = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string?,
];

export interface BybitKlineResult {
  category: string;
  symbol: string;
  list: BybitKlineTuple[];
}
