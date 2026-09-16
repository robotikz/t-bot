import { describe, expect, it } from 'vitest';
import { Timeframe } from '../../brokers/domain/types.js';
import { SignalType } from '../domain/signal.js';
import { StrategyRegistry } from './strategy-registry.service.js';
import { StrategyNotFoundException } from './errors/strategy-not-found.exception.js';

describe('StrategyRegistry', () => {
  it('lists registered strategies', () => {
    const registry = new StrategyRegistry();

    const strategies = registry.list();

    expect(strategies).toEqual([
      {
        id: 'ema-crossover',
        name: 'EMA Crossover',
        description: 'Generates signals from fast/slow EMA crossovers',
      },
      {
        id: 'rsi',
        name: 'RSI',
        description: 'Generates signals from RSI overbought/oversold levels',
      },
    ]);
  });

  it('returns strategy by id', () => {
    const registry = new StrategyRegistry();

    const strategy = registry.getById('ema-crossover');

    expect(strategy.id).toBe('ema-crossover');
  });

  it('throws for unknown strategy', () => {
    const registry = new StrategyRegistry();

    expect(() => registry.getById('unknown')).toThrow(StrategyNotFoundException);
  });

  it('evaluates a strategy by id', () => {
    const registry = new StrategyRegistry();

    const signal = registry.evaluate('rsi', {
      symbol: 'BTCUSDT',
      timeframe: Timeframe.H1,
      candles: [
        {
          symbol: 'BTCUSDT',
          timeframe: Timeframe.H1,
          openTime: new Date('2026-09-16T00:00:00.000Z'),
          closeTime: new Date('2026-09-16T00:59:59.000Z'),
          open: 100,
          high: 100,
          low: 100,
          close: 100,
          volume: 1,
          isClosed: true,
        },
      ],
    });

    expect(signal.strategyId).toBe('rsi');
    expect(signal.type).toBe(SignalType.HOLD);
  });
});
