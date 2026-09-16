import { OrderSide, OrderStatus, Timeframe } from '../../../common/enums.js';
import { BrokerCapability } from './broker-capability.js';

export type BrokerId = string;
export type Symbol = string;

export { Timeframe };

export enum BrokerType {
  CRYPTO_EXCHANGE = 'crypto_exchange',
  STOCK_BROKER = 'stock_broker',
}

export interface Market {
  symbol: Symbol;
  baseAsset?: string;
  quoteAsset?: string;
  active?: boolean;
}

export interface Instrument {
  symbol: Symbol;
  tickSize?: number;
  lotSize?: number;
  baseAsset?: string;
  quoteAsset?: string;
  active?: boolean;
  status?: string;
}

export interface Candle {
  brokerId?: BrokerId;
  symbol: Symbol;
  timeframe: Timeframe;
  openTime: Date;
  closeTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed?: boolean;
}

export interface Balance {
  asset: string;
  free: number;
  locked?: number;
}

export interface Position {
  symbol: Symbol;
  size: number;
  entryPrice?: number;
  currentPrice?: number;
  marketValue?: number;
  currency?: string;
  availableQuantity?: number;
  unrealizedPnl?: number;
}

export interface OrderRequest {
  symbol: Symbol;
  side: OrderSide;
  quantity: number;
  price?: number;
  type?: string;
}

export interface OrderResult {
  id: string;
  status: OrderStatus;
  filledQuantity?: number;
}

export interface Order {
  id: string;
  symbol: Symbol;
  side: OrderSide;
  price?: number;
  quantity: number;
  status: OrderStatus;
}

export interface Account {
  id: string;
  brokerId: BrokerId;
  currency?: string;
  cash?: number;
  investedValue?: number;
  totalValue?: number;
  realizedPnl?: number;
  unrealizedPnl?: number;
  balances?: Balance[];
}

export interface SymbolInfo {
  symbol: Symbol;
  description?: string;
}

export interface BrokerDescriptor {
  id: BrokerId;
  name: string;
  type: BrokerType;
  capabilities: BrokerCapability[];
}
