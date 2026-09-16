import { Injectable } from '@nestjs/common';
import { StrategyNotFoundException } from './errors/strategy-not-found.exception.js';
import { IndicatorEngine } from '../domain/indicator-engine.js';
import { EmaCrossoverStrategy } from '../domain/strategies/ema-crossover.strategy.js';
import { RsiStrategy } from '../domain/strategies/rsi.strategy.js';
import { Strategy } from '../domain/strategy.js';
import { StrategyContext } from '../domain/strategy-context.js';

export type StrategySummary = Pick<Strategy, 'id' | 'name' | 'description'>;
export type StrategyParameters = Record<string, number | string | boolean | null | undefined>;

type StrategyFactory = (parameters?: StrategyParameters) => Strategy;

type RegisteredStrategy = {
  summary: StrategySummary;
  create: StrategyFactory;
};

@Injectable()
export class StrategyRegistry {
  private readonly strategies = new Map<string, RegisteredStrategy>();

  constructor() {
    const indicatorEngine = new IndicatorEngine();
    this.register(
      {
        id: 'ema-crossover',
        name: 'EMA Crossover',
        description: 'Generates signals from fast/slow EMA crossovers',
      },
      (parameters) =>
        new EmaCrossoverStrategy(
          indicatorEngine,
          this.resolveNumber(parameters?.fastPeriod, 9),
          this.resolveNumber(parameters?.slowPeriod, 21),
        ),
    );
    this.register(
      {
        id: 'rsi',
        name: 'RSI',
        description: 'Generates signals from RSI overbought/oversold levels',
      },
      (parameters) =>
        new RsiStrategy(
          indicatorEngine,
          this.resolveNumber(parameters?.period, 14),
          this.resolveNumber(parameters?.oversold, 30),
          this.resolveNumber(parameters?.overbought, 70),
        ),
    );
  }

  list(): StrategySummary[] {
    return Array.from(this.strategies.values()).map((strategy) => ({
      id: strategy.summary.id,
      name: strategy.summary.name,
      description: strategy.summary.description,
    }));
  }

  getById(strategyId: string): Strategy {
    const registeredStrategy = this.strategies.get(strategyId);
    if (!registeredStrategy) {
      throw new StrategyNotFoundException(strategyId);
    }

    return registeredStrategy.create();
  }

  evaluate(strategyId: string, context: StrategyContext, parameters?: StrategyParameters) {
    const registeredStrategy = this.strategies.get(strategyId);
    if (!registeredStrategy) {
      throw new StrategyNotFoundException(strategyId);
    }

    return registeredStrategy.create(parameters).evaluate(context);
  }

  private register(summary: StrategySummary, create: StrategyFactory) {
    this.strategies.set(summary.id, { summary, create });
  }

  private resolveNumber(value: number | string | boolean | null | undefined, fallback: number) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }
}
