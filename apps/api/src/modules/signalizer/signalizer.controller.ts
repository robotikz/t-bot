import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SignalizerService } from './signalizer.service.js';

@Controller('/api/signalizer')
export class SignalizerController {
  constructor(private readonly service: SignalizerService) {}

  @Post('/observations')
  async createObservation(@Body() body: any) {
    return this.service.createObservation(body);
  }

  @Get('/history')
  async history(
    @Query('symbol') symbol?: string,
    @Query('state') state?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit = '100'
  ) {
    return this.service.getHistory({ symbol, state, from, to, limit: Number(limit) });
  }

  @Get('/transitions')
  async transitions(@Query('symbol') symbol?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getTransitions({ symbol, from, to });
  }

  @Get('/state/:symbol')
  async state(@Param('symbol') symbol: string) {
    return this.service.getCurrentState(symbol);
  }
}
