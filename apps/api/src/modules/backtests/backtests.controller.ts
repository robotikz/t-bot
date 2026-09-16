import { Body, Controller, Post } from '@nestjs/common';
import { MARKET_DATA_PUBLIC_TIMEFRAME_TO_DOMAIN_TIMEFRAME } from '../market-data/market-data.constants.js';
import { RunBacktestDto } from './dto/run-backtest.dto.js';
import { BacktestService } from './backtest.service.js';

@Controller('backtests')
export class BacktestsController {
  constructor(private readonly backtestService: BacktestService) {}

  @Post()
  async run(@Body() body: RunBacktestDto) {
    return this.backtestService.run({
      brokerId: body.broker,
      symbol: body.symbol.toUpperCase(),
      timeframe: MARKET_DATA_PUBLIC_TIMEFRAME_TO_DOMAIN_TIMEFRAME[body.timeframe],
      strategyId: body.strategyId,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      initialCapital: body.initialCapital,
      feeRate: body.feeRate,
      strategyParameters: body.strategyParameters,
    });
  }
}
