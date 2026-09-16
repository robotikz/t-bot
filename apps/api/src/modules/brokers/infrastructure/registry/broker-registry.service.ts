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
    if (this.configService.getBoolean('BYBIT_ENABLED', false)) {
      this.brokerManager.register(
        new BybitBrokerAdapter({
          testnet: this.configService.getBoolean('BYBIT_TESTNET', false),
          baseUrl: this.configService.getString('BYBIT_BASE_URL', ''),
          timeoutMs: this.configService.getNumber('BYBIT_TIMEOUT_MS', 10000),
          apiKey: this.configService.getString('BYBIT_API_KEY', ''),
          apiSecret: this.configService.getString('BYBIT_API_SECRET', ''),
        }),
      );
    }

    if (this.configService.getBoolean('TRADING212_ENABLED', false)) {
      this.brokerManager.register(
        new Trading212BrokerAdapter({
          baseUrl: this.configService.getString('TRADING212_BASE_URL', ''),
          environment: this.configService.getString('TRADING212_ENVIRONMENT', 'demo'),
          timeoutMs: this.configService.getNumber('TRADING212_TIMEOUT_MS', 10000),
          apiKey: this.configService.getString('TRADING212_API_KEY', ''),
          apiSecret: this.configService.getString('TRADING212_API_SECRET', ''),
        }),
      );
    }
  }
}
