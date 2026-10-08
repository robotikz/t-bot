import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/config.js';

interface KlineOpts {
  start: number;
  delta: number;
  limit: number;
  intervalMs: number;
}

function makeBybitKlines(options: KlineOpts): [string, string, string, string, string, string, string][] {
  const rows: [string, string, string, string, string, string, string][] = [];
  const now = Date.now();

  for (let i = 0; i < options.limit; i += 1) {
    const ageIndex = options.limit - i - 1;
    const close = options.start + ageIndex * options.delta;
    const open = close - options.delta;
    const high = Math.max(open, close) * 1.01;
    const low = Math.min(open, close) * 0.99;
    const timestamp = now - ageIndex * options.intervalMs;

    rows.push([
      String(timestamp),
      open.toFixed(4),
      high.toFixed(4),
      low.toFixed(4),
      close.toFixed(4),
      '1000',
      (close * 1000).toFixed(4)
    ]);
  }

  return rows.reverse();
}

describe('scanner api integration', () => {
  const requestedUrls: string[] = [];

  beforeEach(() => {
    requestedUrls.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(typeof input === 'string' ? input : input.toString());
        requestedUrls.push(url.toString());

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
                  },
                  {
                    symbol: 'ASTERUSDT',
                    baseCoin: 'ASTER',
                    quoteCoin: 'USDT',
                    status: 'Settling'
                  }
                ]
              },
              time: Date.now()
            }),
            { status: 200 }
          );
        }

        if (url.pathname.endsWith('/v5/market/tickers')) {
          const symbol = url.searchParams.get('symbol');

          if (symbol) {
            return new Response(
              JSON.stringify({
                retCode: 0,
                retMsg: 'OK',
                result: {
                  category: 'spot',
                  list: [
                    {
                      symbol,
                      lastPrice: '0.1234',
                      price24hPcnt: '0.02',
                      highPrice24h: '0.1290',
                      lowPrice24h: '0.1180',
                      volume24h: '200000',
                      turnover24h: '5000000'
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
                list: [
                  {
                    symbol: 'ASTERUSDC',
                    lastPrice: '0.1234',
                    price24hPcnt: '0.01',
                    highPrice24h: '0.1290',
                    lowPrice24h: '0.1180',
                    volume24h: '200000',
                    turnover24h: '5000000'
                  }
                ]
              },
              time: Date.now()
            }),
            { status: 200 }
          );
        }

        if (url.pathname.endsWith('/v5/market/kline')) {
          const symbol = url.searchParams.get('symbol') ?? 'ASTERUSDC';
          const interval = url.searchParams.get('interval') ?? '60';
          const limit = Number(url.searchParams.get('limit') ?? '100');
          const intervalMs = interval === '15' ? 15 * 60_000 : 60 * 60_000;

          const list = makeBybitKlines({ start: 0.1234, delta: 0.0001, limit, intervalMs });

          return new Response(
            JSON.stringify({
              retCode: 0,
              retMsg: 'OK',
              result: {
                category: 'spot',
                symbol,
                list
              },
              time: Date.now()
            }),
            { status: 200 }
          );
        }

        return new Response('Not found', { status: 404 });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns scanner candidates from mocked bybit responses', async () => {
    const config = {
      ...loadConfig(),
      bybitBaseUrl: 'https://api.bybit.eu',
      analysisCandleLimit: 100,
      topCandidates: 5
    };

    const app = createApp({ config });
    const response = await app.inject({ method: 'GET', url: '/api/scanner?quoteCoin=USDC' });

    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      data: {
        count: number;
        candidates: Array<{ symbol: string; score: number }>;
      };
    };

    expect(body.data.count).toBeGreaterThan(0);
    expect(body.data.candidates[0]?.symbol).toBe('ASTERUSDC');
    expect(body.data.candidates[0]?.score).toBeGreaterThan(0);
    expect(body.data.candidates.some((item) => item.symbol === 'ASTERUSDT')).toBe(false);

    const requested = requestedUrls.map((item) => new URL(item));
    const origins = new Set(requested.map((item) => item.origin));
    expect(origins).toEqual(new Set(['https://api.bybit.eu']));

    const instrumentsCalls = requested.filter((item) => item.pathname.endsWith('/v5/market/instruments-info'));
    expect(instrumentsCalls.length).toBeGreaterThan(0);
    expect(instrumentsCalls[0]?.searchParams.get('category')).toBe('spot');

    const tickerCalls = requested.filter((item) => item.pathname.endsWith('/v5/market/tickers'));
    expect(tickerCalls.some((item) => item.searchParams.get('symbol') === 'ASTERUSDC')).toBe(true);
    expect(tickerCalls.some((item) => item.searchParams.get('symbol') === 'ASTERUSDT')).toBe(false);

    const klineCalls = requested.filter((item) => item.pathname.endsWith('/v5/market/kline'));
    expect(klineCalls.length).toBeGreaterThan(0);
    expect(klineCalls.every((item) => item.searchParams.get('symbol') === 'ASTERUSDC')).toBe(true);
    expect(klineCalls.some((item) => item.searchParams.get('interval') === '15')).toBe(true);
    expect(klineCalls.some((item) => item.searchParams.get('interval') === '60')).toBe(true);

    await app.close();
  });
});
