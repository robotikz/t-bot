import { NotFoundException } from '@nestjs/common';

export class BrokerNotFoundException extends NotFoundException {
  constructor(brokerId: string) {
    super(`Broker ${brokerId} not found`);
  }
}
