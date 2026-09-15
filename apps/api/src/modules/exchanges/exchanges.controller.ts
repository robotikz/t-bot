import { Controller, Get, Query } from '@nestjs/common';
import { ExchangesService } from './exchanges.service.js';
import { ListExchangesDto } from './dto/list-exchanges.dto.js';

@Controller('exchanges')
export class ExchangesController {
  constructor(private readonly service: ExchangesService) {}

  @Get()
  async list(@Query() query: ListExchangesDto) {
    return this.service.list(query);
  }
}
