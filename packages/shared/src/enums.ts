export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  NEW = 'NEW',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export enum Timeframe {
  M1 = 'M1',
  M5 = 'M5',
  M15 = 'M15',
  H1 = 'H1',
  H4 = 'H4',
  D1 = 'D1',
}

export enum ExchangeName {
  BINANCE = 'BINANCE',
  BYBIT = 'BYBIT',
  OKX = 'OKX',
}

export enum ScannerTimeframeEnum {
  M15 = '15m',
  H1 = '1h',
  H4 = '4h',
}

export enum CandidateStatusEnum {
  CANDIDATE = 'CANDIDATE',
  WATCH = 'WATCH',
  REJECTED = 'REJECTED',
}

export enum TrendDirectionEnum {
  UP = 'UP',
  DOWN = 'DOWN',
  SIDEWAYS = 'SIDEWAYS',
}
