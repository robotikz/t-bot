import { BrokerCapability } from '../../domain/broker-capability.js';
import { BrokerType } from '../../domain/types.js';
import { InMemoryBrokerAdapter } from '../in-memory-adapter.js';

export class BybitBrokerAdapter extends InMemoryBrokerAdapter {
  constructor() {
    super('bybit', 'Bybit', BrokerType.CRYPTO_EXCHANGE, [
      BrokerCapability.MARKET_DATA,
      BrokerCapability.ACCOUNT,
      BrokerCapability.TRADING,
    ]);
  }
}
