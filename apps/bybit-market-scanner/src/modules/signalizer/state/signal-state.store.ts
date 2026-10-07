import type { MarketSignal } from '../signalizer.types.js';

export interface SignalStateStore {
  get(symbol: string): MarketSignal | undefined;
  set(symbol: string, signal: MarketSignal): void;
  getAll(): MarketSignal[];
  clear(): void;
}

export class InMemorySignalStateStore implements SignalStateStore {
  private readonly latestBySymbol = new Map<string, MarketSignal>();

  get(symbol: string): MarketSignal | undefined {
    return this.latestBySymbol.get(symbol);
  }

  set(symbol: string, signal: MarketSignal): void {
    this.latestBySymbol.set(symbol, signal);
  }

  getAll(): MarketSignal[] {
    return Array.from(this.latestBySymbol.values());
  }

  clear(): void {
    this.latestBySymbol.clear();
  }
}
