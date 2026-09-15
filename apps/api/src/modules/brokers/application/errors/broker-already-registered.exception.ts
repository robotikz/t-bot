import { ConflictException } from '@nestjs/common';

export class BrokerAlreadyRegisteredException extends ConflictException {
  constructor(brokerId: string) {
    super(`Broker with id ${brokerId} already registered`);
  }
}
