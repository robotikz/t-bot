import { Injectable } from '@nestjs/common';
import { AccountProvider } from '../domain/account-provider.js';
import { BrokerAdapter } from '../domain/broker-adapter.js';
import { BrokerCapability } from '../domain/broker-capability.js';
import { MarketDataProvider } from '../domain/market-data-provider.js';
import { TradingProvider } from '../domain/trading-provider.js';
import { BrokerAlreadyRegisteredException } from './errors/broker-already-registered.exception.js';
import { BrokerCapabilityNotSupportedException } from './errors/broker-capability-not-supported.exception.js';
import { BrokerConnectionException } from './errors/broker-connection.exception.js';
import { BrokerNotFoundException } from './errors/broker-not-found.exception.js';

@Injectable()
export class BrokerManager {
  private adapters = new Map<string, BrokerAdapter>();

  register(adapter: BrokerAdapter) {
    if (this.adapters.has(adapter.id)) {
      throw new BrokerAlreadyRegisteredException(adapter.id);
    }
    this.adapters.set(adapter.id, adapter);
  }

  getBroker(id: string): BrokerAdapter {
    const b = this.adapters.get(id);
    if (!b) throw new BrokerNotFoundException(id);
    return b;
  }

  getBrokers(): BrokerAdapter[] {
    return Array.from(this.adapters.values());
  }

  hasCapability(brokerId: string, capability: BrokerCapability): boolean {
    const b = this.getBroker(brokerId);
    return b.capabilities.includes(capability);
  }

  requireCapability(brokerId: string, capability: BrokerCapability): BrokerAdapter {
    const broker = this.getBroker(brokerId);
    if (!broker.capabilities.includes(capability)) {
      throw new BrokerCapabilityNotSupportedException(brokerId, capability);
    }
    return broker;
  }

  getMarketDataProvider(brokerId: string): MarketDataProvider {
    const broker = this.requireCapability(brokerId, BrokerCapability.MARKET_DATA);
    if (!broker.marketData) {
      throw new BrokerCapabilityNotSupportedException(brokerId, BrokerCapability.MARKET_DATA);
    }
    return broker.marketData;
  }

  getAccountProvider(brokerId: string): AccountProvider {
    const broker = this.requireCapability(brokerId, BrokerCapability.ACCOUNT);
    if (!broker.account) {
      throw new BrokerCapabilityNotSupportedException(brokerId, BrokerCapability.ACCOUNT);
    }
    return broker.account;
  }

  getTradingProvider(brokerId: string): TradingProvider {
    const broker = this.requireCapability(brokerId, BrokerCapability.TRADING);
    if (!broker.trading) {
      throw new BrokerCapabilityNotSupportedException(brokerId, BrokerCapability.TRADING);
    }
    return broker.trading;
  }

  async connect(brokerId: string) {
    const b = this.getBroker(brokerId);
    try {
      await b.connect();
    } catch {
      throw new BrokerConnectionException(brokerId, 'connect');
    }
  }

  async disconnect(brokerId: string) {
    const b = this.getBroker(brokerId);
    try {
      await b.disconnect();
    } catch {
      throw new BrokerConnectionException(brokerId, 'disconnect');
    }
  }
}
