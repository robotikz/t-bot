import { describe, expect, it, vi } from 'vitest';
import { Timeframe } from '../../../../common/enums.js';
import { BybitBrokerAdapter } from './bybit-broker.adapter.js';

function createResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('BybitBrokerAdapter', () => {
  it('exposes the correct broker descriptor and lifecycle', async () => {
    const adapter = new BybitBrokerAdapter();

    expect(adapter.id).toBe('bybit');
    expect(adapter.name).toBe('Bybit');
    expect(adapter.type).toBe('crypto_exchange');
    expect(adapter.capabilities).toEqual(['market_data']);
    expect(adapter.isConnected()).toBe(false);

    await adapter.connect();
    expect(adapter.isConnected()).toBe(true);

    await adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
  });

  it('loads markets and candles from the Bybit client', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = new URL(input.toString());

      if (url.pathname.endsWith('/v5/market/instruments-info')) {
        return createResponse({
          retCode: 0,
          retMsg: 'OK',
          result: {
            category: 'spot',
            list: [
              {
                symbol: 'BTCUSDT',
                baseCoin: 'BTC',
                quoteCoin: 'USDT',
                status: 'Trading',
                priceFilter: { tickSize: '0.10' },
                lotSizeFilter: { qtyStep: '0.00001000' },
              },
            ],
          },
        });
      }

      if (url.pathname.endsWith('/v5/market/kline')) {
        return createResponse({
          retCode: 0,
          retMsg: 'OK',
          result: {
            category: 'spot',
            symbol: 'BTCUSDT',
            list: [
              ['1700000060000', '101.5', '102.0', '100.9', '101.1', '12.5', '1264.6'],
              ['1700000000000', '100.0', '101.2', '99.5', '101.0', '10.0', '1010.0'],
            ],
          },
        });
      }

      throw new Error(`Unexpected URL ${url.toString()}`);
    });

    const adapter = new BybitBrokerAdapter({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const markets = await adapter.getMarkets();
    expect(markets).toEqual([
      {
        symbol: 'BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        active: true,
      },
    ]);

    const instrument = await adapter.getInstrument('BTCUSDT');
    expect(instrument).toEqual({
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      active: true,
      status: 'Trading',
      tickSize: 0.1,
      lotSize: 0.00001,
    });

    const candles = await adapter.getCandles('BTCUSDT', Timeframe.M1, 2);
    expect(candles).toHaveLength(2);
    expect(candles[0].symbol).toBe('BTCUSDT');
    expect(candles[0].timeframe).toBe(Timeframe.M1);
    expect(candles[0].open).toBe(100);
    expect(candles[1].open).toBe(101.5);
    expect(candles[0].openTime.getTime()).toBeLessThan(candles[1].openTime.getTime());
  });
});
