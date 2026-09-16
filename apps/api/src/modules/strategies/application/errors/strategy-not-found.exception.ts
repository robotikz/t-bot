import { NotFoundException } from '@nestjs/common';

export class StrategyNotFoundException extends NotFoundException {
  constructor(strategyId: string) {
    super(`Strategy ${strategyId} not found`);
  }
}
