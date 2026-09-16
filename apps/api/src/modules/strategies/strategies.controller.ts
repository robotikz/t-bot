import { Controller, Get, Param, Query } from '@nestjs/common';
import { StrategiesService } from './strategies.service.js';
import { EvaluateStrategyDto } from './dto/evaluate-strategy.dto.js';

@Controller('strategies')
export class StrategiesController {
  constructor(private readonly service: StrategiesService) {}

  @Get()
  async list() {
    return this.service.list();
  }

  @Get(':strategyId/evaluate')
  async evaluate(@Param('strategyId') strategyId: string, @Query() query: EvaluateStrategyDto) {
    return this.service.evaluate(strategyId, query);
  }
}
