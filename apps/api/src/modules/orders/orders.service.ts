import { Injectable } from '@nestjs/common';
import { OrderRepository } from './order.repository.js';
import { ListOrdersDto } from './dto/list-orders.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly repo: OrderRepository,
    private readonly prismaService: PrismaService,
  ) {}

  async list(query: ListOrdersDto) {
    this.prismaService.assertDatabaseAvailable();
    return this.repo.findAll(query);
  }
}
