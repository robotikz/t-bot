import { Injectable } from '@nestjs/common';

@Injectable()
export class StrategyRepository {
  constructor() {}

  async findAll(filter: { name?: string; enabled?: boolean } = {}) {
    void filter;
    return [];
  }
}
