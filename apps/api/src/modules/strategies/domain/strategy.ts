import { Signal } from './signal.js';
import { StrategyContext } from './strategy-context.js';

export interface Strategy {
  readonly id: string;
  readonly name: string;
  readonly description: string;

  evaluate(context: StrategyContext): Signal;
}
