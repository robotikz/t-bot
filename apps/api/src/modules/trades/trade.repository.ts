import { Injectable } from '@nestjs/common';

@Injectable()
export class TradeRepository {
  constructor() {}

  async findAll(filter: { exchange?: string; symbol?: string } = {}) {
    void filter;
    return [];
  }
}
