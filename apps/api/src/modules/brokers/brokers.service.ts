import { Injectable } from '@nestjs/common';
import { BrokerManager } from './application/broker-manager.js';
import { BrokerInstrumentNotFoundException } from './application/errors/broker-instrument-not-found.exception.js';
import { Timeframe } from '../../common/enums.js';

@Injectable()
export class BrokersService {
  constructor(private readonly brokerManager: BrokerManager) {}

  list() {
    return this.brokerManager.getBrokers().map((broker) => broker.descriptor());
  }

  get(id: string) {
    return this.brokerManager.getBroker(id).descriptor();
  }

  getCapabilities(id: string) {
    return this.brokerManager.getBroker(id).capabilities;
  }

  async getMarkets(id: string) {
    return this.brokerManager.getMarketDataProvider(id).getMarkets();
  }

  async getInstrument(id: string, symbol: string) {
    const instrument = await this.brokerManager.getMarketDataProvider(id).getInstrument(symbol);
    if (!instrument) {
      throw new BrokerInstrumentNotFoundException(id, symbol);
    }

    return instrument;
  }

  async getCandles(id: string, symbol: string, timeframe: Timeframe, limit?: number) {
    return this.brokerManager.getMarketDataProvider(id).getCandles(symbol, timeframe, limit);
  }
}
