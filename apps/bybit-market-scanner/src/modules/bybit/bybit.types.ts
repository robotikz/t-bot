export interface BybitResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
  time: number;
}

export interface BybitInstrument {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  status: string;
  lotSizeFilter?: {
    minOrderQty?: string;
    minOrderAmt?: string;
    qtyStep?: string;
  };
  priceFilter?: {
    tickSize?: string;
  };
  minOrderQty?: string;
  minOrderAmt?: string;
  tickSize?: string;
  basePrecision?: string;
  quotePrecision?: string;
}

export interface BybitTicker {
  symbol: string;
  lastPrice: string;
  price24hPcnt: string;
  highPrice24h: string;
  lowPrice24h: string;
  volume24h: string;
  turnover24h: string;
  bid1Price?: string;
  ask1Price?: string;
}

export type BybitKline = [
  string,
  string,
  string,
  string,
  string,
  string,
  string
];

export interface BybitInstrumentsResult {
  category: string;
  list: BybitInstrument[];
}

export interface BybitTickersResult {
  category: string;
  list: BybitTicker[];
}

export interface BybitKlinesResult {
  category: string;
  symbol: string;
  list: BybitKline[];
}
