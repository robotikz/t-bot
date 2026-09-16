import { BadRequestException } from '@nestjs/common';

export class InvalidIndicatorInputException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}
