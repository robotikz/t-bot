import { BrokerCapability } from '../../domain/broker-capability.js';
import { BrokerType } from '../../domain/types.js';
import { InMemoryBrokerAdapter } from '../in-memory-adapter.js';

export class Trading212BrokerAdapter extends InMemoryBrokerAdapter {
  constructor() {
    super('trading212', 'Trading212', BrokerType.STOCK_BROKER, [
      BrokerCapability.ACCOUNT,
      BrokerCapability.TRADING,
    ]);
  }
}
