import { Injectable } from '@nestjs/common';
import { StrategyNotFoundException } from './errors/strategy-not-found.exception.js';
import { IndicatorEngine } from '../domain/indicator-engine.js';
import { EmaCrossoverStrategy } from '../domain/strategies/ema-crossover.strategy.js';
import { RsiStrategy } from '../domain/strategies/rsi.strategy.js';
import { Strategy } from '../domain/strategy.js';
import { StrategyContext } from '../domain/strategy-context.js';

export type StrategySummary = Pick<Strategy, 'id' | 'name' | 'description'>;

@Injectable()
export class StrategyRegistry {
  private readonly strategies = new Map<string, Strategy>();

  constructor() {
    const indicatorEngine = new IndicatorEngine();
    this.register(new EmaCrossoverStrategy(indicatorEngine));
    this.register(new RsiStrategy(indicatorEngine));
  }

  list(): StrategySummary[] {
    return Array.from(this.strategies.values()).map((strategy) => ({
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
    }));
  }

  getById(strategyId: string): Strategy {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new StrategyNotFoundException(strategyId);
    }

    return strategy;
  }

  evaluate(strategyId: string, context: StrategyContext) {
    return this.getById(strategyId).evaluate(context);
  }

  private register(strategy: Strategy) {
    this.strategies.set(strategy.id, strategy);
  }
}
