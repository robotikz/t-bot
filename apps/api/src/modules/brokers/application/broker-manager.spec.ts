import { describe, expect, it } from 'vitest';
import { BrokerManager } from './broker-manager.js';
import { InMemoryBrokerAdapter } from '../infrastructure/in-memory-adapter.js';
import { BrokerCapability } from '../domain/broker-capability.js';
import { BrokerType } from '../domain/types.js';
import { BrokerCapabilityNotSupportedException } from './errors/broker-capability-not-supported.exception.js';

describe('BrokerManager', () => {
  it('registers and lists brokers', () => {
    const manager = new BrokerManager();
    const broker = new InMemoryBrokerAdapter('bybit', 'Bybit', BrokerType.CRYPTO_EXCHANGE, [BrokerCapability.MARKET_DATA]);

    manager.register(broker);

    expect(manager.getBrokers()).toHaveLength(1);
    expect(manager.getBroker('bybit')).toBe(broker);
  });

  it('rejects duplicate registration', () => {
    const manager = new BrokerManager();
    const broker = new InMemoryBrokerAdapter('bybit', 'Bybit', BrokerType.CRYPTO_EXCHANGE, []);

    manager.register(broker);

    expect(() => manager.register(broker)).toThrowError();
  });

  it('handles unknown broker lookup', () => {
    const manager = new BrokerManager();
    expect(() => manager.getBroker('missing')).toThrowError();
  });

  it('detects capabilities', () => {
    const manager = new BrokerManager();
    manager.register(new InMemoryBrokerAdapter('bybit', 'Bybit', BrokerType.CRYPTO_EXCHANGE, [BrokerCapability.MARKET_DATA]));

    expect(manager.hasCapability('bybit', BrokerCapability.MARKET_DATA)).toBe(true);
    expect(manager.hasCapability('bybit', BrokerCapability.TRADING)).toBe(false);
  });

  it('manages connection lifecycle', async () => {
    const manager = new BrokerManager();
    const broker = new InMemoryBrokerAdapter('bybit', 'Bybit', BrokerType.CRYPTO_EXCHANGE, []);
    manager.register(broker);

    expect(broker.isConnected()).toBe(false);
    await manager.connect('bybit');
    expect(broker.isConnected()).toBe(true);
    await manager.disconnect('bybit');
    expect(broker.isConnected()).toBe(false);
  });

  it('throws on unsupported capability checks for unknown broker', () => {
    const manager = new BrokerManager();
    expect(() => manager.hasCapability('missing', BrokerCapability.ACCOUNT)).toThrowError();
  });

  it('throws for unsupported capability access', () => {
    const manager = new BrokerManager();
    manager.register(new InMemoryBrokerAdapter('trading212', 'Trading212', BrokerType.STOCK_BROKER, [BrokerCapability.ACCOUNT]));

    expect(() => manager.getMarketDataProvider('trading212')).toThrow(BrokerCapabilityNotSupportedException);
    expect(() => manager.getTradingProvider('trading212')).toThrow(BrokerCapabilityNotSupportedException);
  });

  it('returns the Trading212 account provider', () => {
    const manager = new BrokerManager();
    const accountProvider = {
      getAccount: vi.fn(),
      getBalances: vi.fn(),
      getPositions: vi.fn(),
    } as never;
    const broker = new InMemoryBrokerAdapter(
      'trading212',
      'Trading212',
      BrokerType.STOCK_BROKER,
      [BrokerCapability.ACCOUNT],
      undefined,
      accountProvider,
    );
    manager.register(broker);

    expect(manager.getAccountProvider('trading212')).toBe(accountProvider);
  });
});
