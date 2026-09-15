import { Injectable } from '@nestjs/common';
import { BrokerManager } from './application/broker-manager.js';

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
}
