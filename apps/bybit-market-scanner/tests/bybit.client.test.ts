import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BybitClient } from '../src/modules/bybit/bybit.client.js';
import { loadConfig } from '../src/config/config.js';

describe('bybit.client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses BYBIT_API_BASE_URL and preserves exact symbol in tickers + kline calls', async () => {
    const previousBaseUrl = process.env.BYBIT_API_BASE_URL;
    process.env.BYBIT_API_BASE_URL = 'https://api.bybit.eu';

    const requests: URL[] = [];

    vi.mocked(fetch).mockImplementation(async (input: URL | RequestInfo) => {
      const url = new URL(typeof input === 'string' ? input : input.toString());
      requests.push(url);

      if (url.pathname.endsWith('/v5/market/instruments-info')) {
        return new Response(
          JSON.stringify({
            retCode: 0,
            retMsg: 'OK',
            result: {
              category: 'spot',
              list: [
                {
                  symbol: 'ASTERUSDC',
                  baseCoin: 'ASTER',
                  quoteCoin: 'USDC',
                  status: 'Trading'
                }
              ]
            },
            time: Date.now()
          }),
          { status: 200 }
        );
      }

      if (url.pathname.endsWith('/v5/market/tickers')) {
        return new Response(
          JSON.stringify({
            retCode: 0,
            retMsg: 'OK',
            result: {
              category: 'spot',
              list: [
                {
                  symbol: 'ASTERUSDC',
                  lastPrice: '0.1234',
                  price24hPcnt: '0.01',
                  highPrice24h: '0.13',
                  lowPrice24h: '0.12',
                  volume24h: '10000',
                  turnover24h: '2500000'
                }
              ]
            },
            time: Date.now()
          }),
          { status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          retCode: 0,
          retMsg: 'OK',
          result: {
            category: 'spot',
            symbol: 'ASTERUSDC',
            list: [['1700000000000', '0.12', '0.13', '0.11', '0.1234', '1000', '123.4']]
          },
          time: Date.now()
        }),
        { status: 200 }
      );
    });

    const client = new BybitClient(loadConfig());
    await client.getSpotInstruments();
    await client.getSpotTicker('ASTERUSDC');
    await client.getKlines('ASTERUSDC', '15', 100);

    expect(requests.every((url) => url.origin === 'https://api.bybit.eu')).toBe(true);
    expect(requests.some((url) => url.pathname.endsWith('/v5/market/instruments-info'))).toBe(true);
    expect(
      requests.some(
        (url) =>
          url.pathname.endsWith('/v5/market/tickers') &&
          url.searchParams.get('symbol') === 'ASTERUSDC' &&
          url.searchParams.get('category') === 'spot'
      )
    ).toBe(true);
    expect(
      requests.some(
        (url) =>
          url.pathname.endsWith('/v5/market/kline') &&
          url.searchParams.get('symbol') === 'ASTERUSDC' &&
          url.searchParams.get('interval') === '15'
      )
    ).toBe(true);

    if (previousBaseUrl === undefined) {
      delete process.env.BYBIT_API_BASE_URL;
    } else {
      process.env.BYBIT_API_BASE_URL = previousBaseUrl;
    }
  });

  it('follows nextPageCursor across multiple instrument pages without duplicates', async () => {
    const previousBaseUrl = process.env.BYBIT_API_BASE_URL;
    process.env.BYBIT_API_BASE_URL = 'https://api.bybit.eu';

    const cursorsSeen: (string | null)[] = [];

    vi.mocked(fetch).mockImplementation(async (input: URL | RequestInfo) => {
      const url = new URL(typeof input === 'string' ? input : input.toString());
      const cursor = url.searchParams.get('cursor');
      cursorsSeen.push(cursor);

      if (!cursor) {
        return new Response(
          JSON.stringify({
            retCode: 0,
            retMsg: 'OK',
            result: {
              category: 'spot',
              list: [{ symbol: 'ZKUSDC', baseCoin: 'ZK', quoteCoin: 'USDC', status: 'Trading' }],
              nextPageCursor: 'page-2'
            },
            time: Date.now()
          }),
          { status: 200 }
        );
      }

      if (cursor === 'page-2') {
        return new Response(
          JSON.stringify({
            retCode: 0,
            retMsg: 'OK',
            result: {
              category: 'spot',
              list: [{ symbol: 'ASTERUSDC', baseCoin: 'ASTER', quoteCoin: 'USDC', status: 'Trading' }],
              nextPageCursor: ''
            },
            time: Date.now()
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unexpected cursor requested: ${cursor}`);
    });

    const client = new BybitClient(loadConfig());
    const instruments = await client.getSpotInstruments();

    expect(cursorsSeen).toEqual([null, 'page-2']);
    expect(instruments.map((item) => item.symbol).sort()).toEqual(['ASTERUSDC', 'ZKUSDC']);

    if (previousBaseUrl === undefined) {
      delete process.env.BYBIT_API_BASE_URL;
    } else {
      process.env.BYBIT_API_BASE_URL = previousBaseUrl;
    }
  });

  it('stops pagination at a hard page cap instead of looping forever on a buggy cursor', async () => {
    const previousBaseUrl = process.env.BYBIT_API_BASE_URL;
    process.env.BYBIT_API_BASE_URL = 'https://api.bybit.eu';

    let requestCount = 0;

    vi.mocked(fetch).mockImplementation(async () => {
      requestCount += 1;
      return new Response(
        JSON.stringify({
          retCode: 0,
          retMsg: 'OK',
          result: {
            category: 'spot',
            list: [{ symbol: 'LOOPUSDC', baseCoin: 'LOOP', quoteCoin: 'USDC', status: 'Trading' }],
            // Buggy API always returns a cursor and never terminates.
            nextPageCursor: 'always-more'
          },
          time: Date.now()
        }),
        { status: 200 }
      );
    });

    const client = new BybitClient(loadConfig());
    const instruments = await client.getSpotInstruments();

    expect(requestCount).toBeLessThanOrEqual(50);
    expect(instruments).toHaveLength(1);

    if (previousBaseUrl === undefined) {
      delete process.env.BYBIT_API_BASE_URL;
    } else {
      process.env.BYBIT_API_BASE_URL = previousBaseUrl;
    }
  });
});
