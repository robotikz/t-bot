import { BrokerAdapter } from '../../domain/broker-adapter.js';
import { BrokerCapability } from '../../domain/broker-capability.js';
import { MarketDataProvider } from '../../domain/market-data-provider.js';
import { Candle, Instrument, Market, BrokerType, Timeframe } from '../../domain/types.js';
import { BYBIT_MARKET_CATEGORY, getBybitInterval, getBybitIntervalMs } from '../bybit/bybit.constants.js';
import { BybitHttpClient } from '../bybit/bybit-http.client.js';
import { mapBybitCandlesResponse, mapBybitInstrumentResponse, mapBybitMarketsResponse } from '../bybit/bybit.mapper.js';
import { BybitUnsupportedTimeframeException } from '../bybit/bybit.errors.js';

export interface BybitBrokerAdapterOptions {
  baseUrl?: string;
  testnet?: boolean;
  timeoutMs?: number;
  apiKey?: string;
  apiSecret?: string;
  fetchImpl?: typeof fetch;
}

export class BybitBrokerAdapter implements BrokerAdapter, MarketDataProvider {
  readonly id = 'bybit';
  readonly name = 'Bybit';
  readonly type = BrokerType.CRYPTO_EXCHANGE;
  readonly capabilities = [BrokerCapability.MARKET_DATA];
  readonly marketData = this;

  private connected = false;
  private readonly client: BybitHttpClient;

  constructor(options: BybitBrokerAdapterOptions = {}) {
    this.client = new BybitHttpClient({
      baseUrl: options.baseUrl,
      testnet: options.testnet,
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

  async getMarkets(): Promise<Market[]> {
    const response = await this.client.getInstrumentsInfo(BYBIT_MARKET_CATEGORY);
    return mapBybitMarketsResponse(response.result);
  }

  async getInstrument(symbol: string): Promise<Instrument | null> {
    const response = await this.client.getInstrumentsInfo(BYBIT_MARKET_CATEGORY, symbol);
    return mapBybitInstrumentResponse(response.result);
  }

  async getCandles(
    symbol: string,
    timeframe: Timeframe,
    limit?: number,
    options?: { beforeOpenTime?: Date },
  ): Promise<Candle[]> {
    const interval = getBybitInterval(timeframe);
    const intervalMs = getBybitIntervalMs(timeframe);

    if (!interval || !intervalMs) {
      throw new BybitUnsupportedTimeframeException(timeframe);
    }

    const response = await this.client.getKline(
      BYBIT_MARKET_CATEGORY,
      symbol,
      interval,
      limit,
      options?.beforeOpenTime ? options.beforeOpenTime.getTime() - 1 : undefined,
    );
    return mapBybitCandlesResponse(response.result, symbol, timeframe, intervalMs);
  }
}
