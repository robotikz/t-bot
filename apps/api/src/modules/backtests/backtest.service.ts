import { BadRequestException, Injectable } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service.js';
import { StrategyRegistry } from '../strategies/application/strategy-registry.service.js';
import { BacktestEngine } from './application/backtest-engine.js';
import { BacktestConfig, BacktestResult } from './domain/backtest.types.js';

type RunBacktestRequest = BacktestConfig;

@Injectable()
export class BacktestService {
  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly strategyRegistry: StrategyRegistry,
  ) {}

  async run(request: RunBacktestRequest): Promise<BacktestResult> {
    this.validateRequest(request);

    const candles = await this.marketDataService.loadCandlesInRange({
      brokerId: request.brokerId,
      symbol: request.symbol,
      timeframe: request.timeframe,
      startTime: request.startTime,
      endTime: request.endTime,
    });

    if (!candles.length) {
      throw new BadRequestException('No historical candles available for the requested backtest range');
    }

    const engine = new BacktestEngine(this.strategyRegistry);
    return engine.run(request, candles);
  }

  private validateRequest(request: RunBacktestRequest) {
    if (!(request.startTime instanceof Date) || Number.isNaN(request.startTime.getTime())) {
      throw new BadRequestException('startTime must be a valid date');
    }

    if (!(request.endTime instanceof Date) || Number.isNaN(request.endTime.getTime())) {
      throw new BadRequestException('endTime must be a valid date');
    }

    if (request.startTime.getTime() >= request.endTime.getTime()) {
      throw new BadRequestException('startTime must be before endTime');
    }

    if (!Number.isFinite(request.initialCapital) || request.initialCapital <= 0) {
      throw new BadRequestException('initialCapital must be greater than zero');
    }

    if (!Number.isFinite(request.feeRate) || request.feeRate < 0 || request.feeRate > 1) {
      throw new BadRequestException('feeRate must be between 0 and 1');
    }
  }
}
