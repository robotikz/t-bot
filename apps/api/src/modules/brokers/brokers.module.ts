import { Module } from '@nestjs/common';
import { BrokersController } from './brokers.controller.js';
import { BrokersService } from './brokers.service.js';
import { BrokerManager } from './application/broker-manager.js';
import { BrokerRegistryService } from './infrastructure/registry/broker-registry.service.js';
import { ConfigModule } from '../config/config.module.js';

@Module({
  imports: [ConfigModule],
  controllers: [BrokersController],
  providers: [BrokersService, BrokerManager, BrokerRegistryService],
  exports: [BrokerManager, BrokersService],
})
export class BrokersModule {}
