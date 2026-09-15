import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../../../config/config.service.js';
import { BrokerManager } from '../../application/broker-manager.js';
import { BybitBrokerAdapter } from '../adapters/bybit-broker.adapter.js';
import { Trading212BrokerAdapter } from '../adapters/trading212-broker.adapter.js';

@Injectable()
export class BrokerRegistryService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly brokerManager: BrokerManager,
  ) {}

  onModuleInit() {
    if (this.isEnabled('BYBIT_ENABLED')) {
      this.brokerManager.register(new BybitBrokerAdapter());
    }

    if (this.isEnabled('TRADING212_ENABLED')) {
      this.brokerManager.register(new Trading212BrokerAdapter());
    }
  }

  private isEnabled(key: 'BYBIT_ENABLED' | 'TRADING212_ENABLED'): boolean {
    return this.configService.getString(key, 'false').toLowerCase() === 'true';
  }
}
