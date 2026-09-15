import { Controller, Get, Query } from '@nestjs/common';
import { TradesService } from './trades.service.js';
import { ListTradesDto } from './dto/list-trades.dto.js';

@Controller('trades')
export class TradesController {
  constructor(private readonly service: TradesService) {}

  @Get()
  async list(@Query() query: ListTradesDto) {
    return this.service.list(query);
  }
}
