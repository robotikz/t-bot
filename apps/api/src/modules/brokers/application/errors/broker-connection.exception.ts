import { ServiceUnavailableException } from '@nestjs/common';

export class BrokerConnectionException extends ServiceUnavailableException {
  constructor(brokerId: string, action: 'connect' | 'disconnect') {
    super(`Failed to ${action} broker ${brokerId}`);
  }
}
