import { NotFoundException } from '@nestjs/common';

export class BrokerInstrumentNotFoundException extends NotFoundException {
  constructor(brokerId: string, symbol: string) {
    super(`Broker ${brokerId} instrument ${symbol} not found`);
  }
}
