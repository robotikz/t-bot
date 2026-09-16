import { Injectable } from '@nestjs/common';
import { MARKET_DATA_PUBLIC_TIMEFRAME_TO_DOMAIN_TIMEFRAME } from '../market-data/market-data.constants.js';
import { StrategyEvaluationService } from './application/strategy-evaluation.service.js';
import { StrategyRegistry } from './application/strategy-registry.service.js';
import { EvaluateStrategyDto } from './dto/evaluate-strategy.dto.js';

@Injectable()
export class StrategiesService {
  constructor(
    private readonly strategyRegistry: StrategyRegistry,
    private readonly strategyEvaluationService: StrategyEvaluationService,
  ) {}

  list() {
    return this.strategyRegistry.list();
  }

  async evaluate(strategyId: string, query: EvaluateStrategyDto) {
    return this.strategyEvaluationService.evaluate({
      brokerId: query.broker,
      symbol: query.symbol,
      timeframe: MARKET_DATA_PUBLIC_TIMEFRAME_TO_DOMAIN_TIMEFRAME[query.timeframe],
      strategyId,
    });
  }
}
