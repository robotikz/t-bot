import { BadRequestException } from '@nestjs/common';

export class InsufficientMarketDataException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}
