import { BrokerAdapter } from '../domain/broker-adapter.js';
import { BrokerCapability } from '../domain/broker-capability.js';
import { AccountProvider } from '../domain/account-provider.js';
import { MarketDataProvider } from '../domain/market-data-provider.js';
import { TradingProvider } from '../domain/trading-provider.js';
import { BrokerType } from '../domain/types.js';

export class InMemoryBrokerAdapter implements BrokerAdapter {
  private connected = false;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: BrokerType,
    public readonly capabilities: BrokerCapability[] = [],
    public readonly marketData?: MarketDataProvider,
    public readonly account?: AccountProvider,
    public readonly trading?: TradingProvider,
  ) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  descriptor() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      capabilities: this.capabilities,
    };
  }
}
