import { Controller, Get, Query } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { ListOrdersDto } from './dto/list-orders.dto.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  async list(@Query() query: ListOrdersDto) {
    return this.service.list(query);
  }
}
