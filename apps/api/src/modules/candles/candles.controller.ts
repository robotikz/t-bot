import { Controller, Get, Query } from '@nestjs/common';
import { CandlesService } from './candles.service.js';
import { ListCandlesDto } from './dto/list-candles.dto.js';

@Controller('candles')
export class CandlesController {
  constructor(private readonly service: CandlesService) {}

  @Get()
  async list(@Query() query: ListCandlesDto) {
    return this.service.list(query);
  }
}
