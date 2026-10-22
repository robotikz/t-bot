import { Injectable } from '@nestjs/common';

@Injectable()
export class ExchangeRepository {
  constructor() {}

  async findAll(filter: { name?: string; enabled?: boolean } = {}) {
    void filter;
    return [];
  }
}
