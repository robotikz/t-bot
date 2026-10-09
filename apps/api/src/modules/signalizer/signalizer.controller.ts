import { Body, Controller, Get, Param, Post, Query, BadRequestException } from '@nestjs/common';
import { SignalizerService } from './signalizer.service.js';
import { HistoryQueryDto } from './dto/history-query.dto.js';
import { TransitionsQueryDto } from './dto/transitions-query.dto.js';
import { StateParamDto } from './dto/state-param.dto.js';
import { ObservationDto } from './dto/observation.dto.js';

@Controller('/api/signalizer')
export class SignalizerController {
  constructor(private readonly service: SignalizerService) {}

  @Post('/observations')
  async createObservation(@Body() body: ObservationDto) {
    return this.service.createObservation(body as any);
  }

  @Get('/history')
  async history(@Query() query: HistoryQueryDto) {
    // date range sanity: if both provided ensure from <= to
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException('from must be before to');
    }

    // normalize symbol to uppercase when present
    if (query.symbol) query.symbol = query.symbol.toUpperCase();

    return this.service.getHistory({ symbol: query.symbol, state: query.state, from: query.from, to: query.to, limit: query.limit });
  }

  @Get('/transitions')
  async transitions(@Query() query: TransitionsQueryDto) {
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException('from must be before to');
    }

    if (query.symbol) query.symbol = query.symbol.toUpperCase();

    return this.service.getTransitions({ symbol: query.symbol, from: query.from, to: query.to });
  }

  @Get('/state/:symbol')
  async state(@Param() params: StateParamDto) {
    return this.service.getCurrentState(params.symbol.toUpperCase());
  }
}
