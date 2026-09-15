import { OrderRequest, OrderResult, Order } from './types.js';

export interface TradingProvider {
  placeOrder(request: OrderRequest): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<void>;
  getOrders(): Promise<Order[]>;
}
