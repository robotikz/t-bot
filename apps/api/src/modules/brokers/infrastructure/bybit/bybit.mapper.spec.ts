import { describe, expect, it } from 'vitest';
import { Timeframe } from '../../../../common/enums.js';
import {
  mapBybitCandlesResponse,
  mapBybitInstrumentResponse,
  mapBybitMarketsResponse,
} from './bybit.mapper.js';

describe('Bybit mapper', () => {
  it('maps instruments to markets', () => {
    const markets = mapBybitMarketsResponse({
      category: 'spot',
      list: [
        {
          symbol: 'BTCUSDT',
          baseCoin: 'BTC',
          quoteCoin: 'USDT',
          status: 'Trading',
        },
      ],
    });

    expect(markets).toEqual([
      {
        symbol: 'BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        active: true,
      },
    ]);
  });

  it('maps instrument details', () => {
    const instrument = mapBybitInstrumentResponse({
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
    });

    expect(instrument).toEqual({
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      active: true,
      status: 'Trading',
      tickSize: 0.1,
      lotSize: 0.00001,
    });
  });

  it('maps candles in chronological order with numeric conversion', () => {
    const candles = mapBybitCandlesResponse(
      {
        category: 'spot',
        symbol: 'BTCUSDT',
        list: [
          ['1700000060000', '101.5', '102.0', '100.9', '101.1', '12.5', '1264.6'],
          ['1700000000000', '100.0', '101.2', '99.5', '101.0', '10.0', '1010.0'],
        ],
      },
      'BTCUSDT',
      Timeframe.M1,
      60_000,
    );

    expect(candles).toHaveLength(2);
    expect(candles[0]).toEqual({
      symbol: 'BTCUSDT',
      timeframe: Timeframe.M1,
      openTime: new Date('2023-11-14T22:13:20.000Z'),
      closeTime: new Date('2023-11-14T22:14:19.999Z'),
      open: 100,
      high: 101.2,
      low: 99.5,
      close: 101,
      volume: 10,
    });
    expect(candles[1].openTime.getTime()).toBeGreaterThan(candles[0].openTime.getTime());
  });
});
