import { BadRequestException } from '@nestjs/common';
import { BrokerCapability } from '../../domain/broker-capability.js';

export class BrokerCapabilityNotSupportedException extends BadRequestException {
  constructor(brokerId: string, capability: BrokerCapability) {
    super(`Broker ${brokerId} does not support capability ${capability}`);
  }
}
