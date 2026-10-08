import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config/config.js';
import { MarketService } from '../src/modules/market/market.service.js';
import type { BybitClient } from '../src/modules/bybit/bybit.client.js';

describe('market.service', () => {
  it('includes only Trading instruments and preserves exact Bybit symbol + metadata', async () => {
    const bybitClient = {
      getSpotInstruments: vi.fn().mockResolvedValue([
        {
          symbol: 'ASTERUSDC',
          baseCoin: 'ASTER',
          quoteCoin: 'USDC',
          status: 'Trading',
          lotSizeFilter: { minOrderQty: '1', minOrderAmt: '5', qtyStep: '1' },
          priceFilter: { tickSize: '0.0001' },
          basePrecision: '0.000001',
          quotePrecision: '0.000001'
        },
        {
          symbol: 'ASTERUSDT',
          baseCoin: 'ASTER',
          quoteCoin: 'USDT',
          status: 'Settling'
        }
      ])
    } as unknown as BybitClient;

    const service = new MarketService(bybitClient, loadConfig());

    const allMarkets = await service.getMarkets();
    const usdcMarkets = await service.getMarketsByQuoteCoin('USDC');
    const usdtMarkets = await service.getMarketsByQuoteCoin('USDT');

    expect(allMarkets).toHaveLength(1);
    expect(allMarkets[0]?.symbol).toBe('ASTERUSDC');
    expect(usdcMarkets).toHaveLength(1);
    expect(usdcMarkets[0]?.symbol).toBe('ASTERUSDC');
    expect(usdcMarkets[0]?.baseCoin).toBe('ASTER');
    expect(usdcMarkets[0]?.quoteCoin).toBe('USDC');
    expect(usdcMarkets[0]?.status).toBe('Trading');
    expect(usdcMarkets[0]?.lotSizeFilter?.minOrderQty).toBe('1');
    expect(usdcMarkets[0]?.minOrderQty).toBe('1');
    expect(usdcMarkets[0]?.minOrderAmt).toBe('5');
    expect(usdcMarkets[0]?.tickSize).toBe('0.0001');
    expect(usdcMarkets[0]?.basePrecision).toBe('0.000001');
    expect(usdcMarkets[0]?.quotePrecision).toBe('0.000001');

    expect(usdtMarkets).toEqual([]);
  });

  it('requests ticker using the exact discovered symbol', async () => {
    const bybitClient = {
      getSpotTicker: vi.fn().mockResolvedValue({
        symbol: 'ASTERUSDC',
        lastPrice: '0.1234',
        price24hPcnt: '0.01',
        highPrice24h: '0.13',
        lowPrice24h: '0.12',
        volume24h: '10000',
        turnover24h: '2500000'
      }),
      getSpotTickers: vi.fn().mockResolvedValue([])
    } as unknown as BybitClient;

    const service = new MarketService(bybitClient, loadConfig());
    const ticker = await service.getMarketTicker('ASTERUSDC');

    expect(vi.mocked(bybitClient.getSpotTicker)).toHaveBeenCalledWith('ASTERUSDC');
    expect(ticker.symbol).toBe('ASTERUSDC');
  });
});
