import { Injectable } from '@nestjs/common';
import { Timeframe } from '../../brokers/domain/types.js';
import { MarketDataService } from '../../market-data/market-data.service.js';
import { InsufficientMarketDataException } from './errors/insufficient-market-data.exception.js';
import { StrategyRegistry } from './strategy-registry.service.js';

type EvaluateStrategyRequest = {
  brokerId: string;
  symbol: string;
  timeframe: Timeframe;
  strategyId: string;
};

@Injectable()
export class StrategyEvaluationService {
  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly strategyRegistry: StrategyRegistry,
  ) {}

  async evaluate(request: EvaluateStrategyRequest) {
    const strategy = this.strategyRegistry.getById(request.strategyId);

    const candles = await this.marketDataService.loadCandles({
      brokerId: request.brokerId,
      symbol: request.symbol,
      timeframe: request.timeframe,
    });

    if (!candles.length) {
      throw new InsufficientMarketDataException('No candle data available for strategy evaluation');
    }

    return strategy.evaluate({
      symbol: request.symbol,
      timeframe: request.timeframe,
      candles,
    });
  }
}
