import { BrokerAdapter } from '../../domain/broker-adapter.js';
import { AccountProvider } from '../../domain/account-provider.js';
import { BrokerCapability } from '../../domain/broker-capability.js';
import { Account, Balance, BrokerType, Position } from '../../domain/types.js';
import { Trading212HttpClient } from '../trading212/trading212-http.client.js';
import {
  mapTrading212AccountSummaryResponse,
  mapTrading212BalancesFromAccountSummaryResponse,
  mapTrading212PositionsResponse,
} from '../trading212/trading212.mapper.js';

export interface Trading212BrokerAdapterOptions {
  baseUrl?: string;
  environment?: string;
  timeoutMs?: number;
  apiKey?: string;
  apiSecret?: string;
  fetchImpl?: typeof fetch;
}

export class Trading212BrokerAdapter implements BrokerAdapter, AccountProvider {
  readonly id = 'trading212';
  readonly name = 'Trading212';
  readonly type = BrokerType.STOCK_BROKER;
  readonly capabilities = [BrokerCapability.ACCOUNT];
  readonly account = this;

  private connected = false;
  private readonly client: Trading212HttpClient;

  constructor(options: Trading212BrokerAdapterOptions = {}) {
    this.client = new Trading212HttpClient({
      baseUrl: options.baseUrl,
      environment: options.environment,
      timeoutMs: options.timeoutMs,
      apiKey: options.apiKey,
      apiSecret: options.apiSecret,
      fetchImpl: options.fetchImpl,
    });
  }

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

  async getAccount(): Promise<Account> {
    const response = await this.client.getAccountSummary();
    return mapTrading212AccountSummaryResponse(response);
  }

  async getBalances(): Promise<Balance[]> {
    const response = await this.client.getAccountSummary();
    return mapTrading212BalancesFromAccountSummaryResponse(response);
  }

  async getPositions(): Promise<Position[]> {
    const response = await this.client.getPositions();
    return mapTrading212PositionsResponse(response);
  }
}
