import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { BrokersService } from './brokers.service.js';
import { ListBybitCandlesDto } from './dto/list-bybit-candles.dto.js';
import { BYBIT_PUBLIC_TIMEFRAME_TO_DOMAIN_TIMEFRAME } from './infrastructure/bybit/bybit.constants.js';

@Controller('brokers')
export class BrokersController {
  constructor(private readonly service: BrokersService) {}

  @Get()
  async list() {
    return this.service.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get(':id/capabilities')
  async capabilities(@Param('id') id: string) {
    return this.service.getCapabilities(id);
  }

  @Get(':id/markets')
  async markets(@Param('id') id: string) {
    return this.service.getMarkets(id);
  }

  @Get(':id/markets/:symbol')
  async market(@Param('id') id: string, @Param('symbol') symbol: string) {
    return this.service.getInstrument(id, symbol.toUpperCase());
  }

  @Get(':id/candles')
  async candles(@Param('id') id: string, @Query() query: ListBybitCandlesDto) {
    const timeframe = BYBIT_PUBLIC_TIMEFRAME_TO_DOMAIN_TIMEFRAME[query.timeframe];
    if (!timeframe) {
      throw new BadRequestException(`Unsupported timeframe ${query.timeframe}`);
    }

    return this.service.getCandles(id, query.symbol.toUpperCase(), timeframe, query.limit);
  }
}
