import { Injectable } from '@nestjs/common';
import { OrderRepository } from './order.repository.js';
import { ListOrdersDto } from './dto/list-orders.dto.js';

@Injectable()
export class OrdersService {
  constructor(private readonly repo: OrderRepository) {}

  async list(query: ListOrdersDto) {
    return this.repo.findAll(query);
  }
}
