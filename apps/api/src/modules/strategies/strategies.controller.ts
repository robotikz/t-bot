import { Controller, Get, Query } from '@nestjs/common';
import { StrategiesService } from './strategies.service.js';
import { ListStrategiesDto } from './dto/list-strategies.dto.js';

@Controller('strategies')
export class StrategiesController {
  constructor(private readonly service: StrategiesService) {}

  @Get()
  async list(@Query() query: ListStrategiesDto) {
    return this.service.list(query);
  }
}
