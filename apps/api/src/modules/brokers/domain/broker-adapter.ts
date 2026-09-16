import { AccountProvider } from './account-provider.js';
import { BrokerCapability } from './broker-capability.js';
import { MarketDataProvider } from './market-data-provider.js';
import { TradingProvider } from './trading-provider.js';
import { BrokerId, BrokerDescriptor, BrokerType } from './types.js';

export interface BrokerAdapter {
  readonly id: BrokerId;
  readonly name: string;
  readonly type: BrokerType;
  readonly capabilities: BrokerCapability[];
  readonly marketData?: MarketDataProvider;
  readonly account?: AccountProvider;
  readonly trading?: TradingProvider;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  descriptor(): BrokerDescriptor;
}
