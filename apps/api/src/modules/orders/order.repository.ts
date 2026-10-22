import { Injectable } from '@nestjs/common';
import type { OrderStatus } from '../../common/enums.js';

@Injectable()
export class OrderRepository {
  constructor() {}

  async findAll(filter: { exchange?: string; status?: OrderStatus; symbol?: string } = {}) {
    void filter;
    return [];
  }
}
