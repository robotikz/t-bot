import { describe, expect, it } from 'vitest';
import { createExecutionMarketResolver } from './execution-market-resolver';
import { MarketInstrument } from './scanner.service';

const instruments: MarketInstrument[] = [
  { symbol: 'BTCUSDT', baseCoin: 'BTC', quoteCoin: 'USDT', status: 'Trading' },
  { symbol: 'BTCUSDC', baseCoin: 'BTC', quoteCoin: 'USDC', status: 'Trading' },
  { symbol: 'ETHUSDT', baseCoin: 'ETH', quoteCoin: 'USDT', status: 'Trading' },
  { symbol: 'ETHUSDC', baseCoin: 'ETH', quoteCoin: 'USDC', status: 'Trading' },
  { symbol: 'SOLUSDT', baseCoin: 'SOL', quoteCoin: 'USDT', status: 'Trading' },
  { symbol: 'SOLUSDC', baseCoin: 'SOL', quoteCoin: 'USDC', status: 'Trading' },
  { symbol: 'XRPUSDT', baseCoin: 'XRP', quoteCoin: 'USDT', status: 'Trading' },
  { symbol: 'XRPUSDC', baseCoin: 'XRP', quoteCoin: 'USDC', status: 'Trading' },
];

describe('ExecutionMarketResolver', () => {
  it.each([
    ['BTCUSDT', 'BTC', 'USDT', 'BTCUSDC'],
    ['BTCUSDC', 'BTC', 'USDC', 'BTCUSDC'],
    ['ETHUSDT', 'ETH', 'USDT', 'ETHUSDC'],
    ['ETHUSDC', 'ETH', 'USDC', 'ETHUSDC'],
    ['SOLUSDT', 'SOL', 'USDT', 'SOLUSDC'],
    ['SOLUSDC', 'SOL', 'USDC', 'SOLUSDC'],
    ['XRPUSDT', 'XRP', 'USDT', 'XRPUSDC'],
    ['XRPUSDC', 'XRP', 'USDC', 'XRPUSDC'],
  ])('resolves %s -> %s/%s/%s', (input, baseAsset, analysisQuote, executionSymbol) => {
    const resolver = createExecutionMarketResolver(instruments);
    const result = resolver.resolveExecutionMarket(input);

    expect(result.analysisSymbol).toBe(input);
    expect(result.baseAsset).toBe(baseAsset);
    expect(result.analysisQuote).toBe(analysisQuote);
    expect(result.executionSymbol).toBe(executionSymbol);
    expect(result.executionMarket).toBe(executionSymbol);
    expect(result.executionQuote).toBe('USDC');
    expect(result.executionAvailable).toBe(true);
  });

  it('never appends USDC blindly to a USDC analysis symbol', () => {
    const resolver = createExecutionMarketResolver(instruments);

    expect(resolver.resolveExecutionMarket('ETHUSDC').executionSymbol).toBe('ETHUSDC');
    expect(resolver.resolveExecutionMarket('SOLUSDC').executionSymbol).toBe('SOLUSDC');
    expect(resolver.resolveExecutionMarket('BTCUSDC').executionSymbol).toBe('BTCUSDC');
    expect(resolver.resolveExecutionMarket('XRPUSDC').executionSymbol).toBe('XRPUSDC');
  });

  it('supports lowercase symbol input', () => {
    const resolver = createExecutionMarketResolver(instruments);
    const result = resolver.resolveExecutionMarket('ethusdt');

    expect(result.analysisSymbol).toBe('ETHUSDT');
    expect(result.baseAsset).toBe('ETH');
    expect(result.executionSymbol).toBe('ETHUSDC');
    expect(result.executionAvailable).toBe(true);
  });

  it('returns unavailable for unsupported base asset', () => {
    const resolver = createExecutionMarketResolver(instruments);
    const result = resolver.resolveExecutionMarket('ADAUSDT');

    expect(result.baseAsset).toBe('ADA');
    expect(result.executionAvailable).toBe(false);
    expect(result.executionSymbol).toBe('');
  });

  it('returns unavailable when USDC pair does not exist', () => {
    const resolver = createExecutionMarketResolver([
      { symbol: 'DOGEUSDT', baseCoin: 'DOGE', quoteCoin: 'USDT', status: 'Trading' },
    ]);
    const result = resolver.resolveExecutionMarket('DOGEUSDT');

    expect(result.baseAsset).toBe('DOGE');
    expect(result.executionAvailable).toBe(false);
    expect(result.executionSymbol).toBe('');
  });

  it('returns unavailable for malformed symbol', () => {
    const resolver = createExecutionMarketResolver(instruments);
    const result = resolver.resolveExecutionMarket('ETH');

    expect(result.executionAvailable).toBe(false);
    expect(result.reason).toContain('Malformed symbol');
  });

  it('handles duplicate symbols and prefers Trading status', () => {
    const resolver = createExecutionMarketResolver([
      { symbol: 'BTCUSDC', baseCoin: 'BTC', quoteCoin: 'USDC', status: 'Closed' },
      { symbol: 'BTCUSDC', baseCoin: 'BTC', quoteCoin: 'USDC', status: 'Trading' },
      { symbol: 'BTCUSDT', baseCoin: 'BTC', quoteCoin: 'USDT', status: 'Trading' },
    ]);

    const result = resolver.resolveExecutionMarket('BTCUSDT');
    expect(result.executionAvailable).toBe(true);
    expect(result.executionSymbol).toBe('BTCUSDC');
  });

  it('returns unavailable when instrument data is missing', () => {
    const resolver = createExecutionMarketResolver([]);
    const result = resolver.resolveExecutionMarket('BTCUSDT');

    expect(result.executionAvailable).toBe(false);
    expect(result.reason).toContain('Missing instrument data');
  });
});
