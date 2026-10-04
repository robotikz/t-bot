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
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(typeof input === 'string' ? input : input.toString());

        if (url.pathname.endsWith('/v5/market/instruments-info')) {
          return new Response(
            JSON.stringify({
              retCode: 0,
              retMsg: 'OK',
              result: {
                category: 'spot',
                list: [
                  {
                    symbol: 'BTCUSDC',
                    baseCoin: 'BTC',
                    quoteCoin: 'USDC',
                    status: 'Trading'
                  },
                  {
                    symbol: 'ETHUSDC',
                    baseCoin: 'ETH',
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
                    symbol: 'BTCUSDC',
                    lastPrice: '100',
                    price24hPcnt: '0.01',
                    highPrice24h: '101',
                    lowPrice24h: '95',
                    volume24h: '100000',
                    turnover24h: '2000000'
                  },
                  {
                    symbol: 'ETHUSDC',
                    lastPrice: '50',
                    price24hPcnt: '0.005',
                    highPrice24h: '51',
                    lowPrice24h: '47',
                    volume24h: '100000',
                    turnover24h: '1500000'
                  }
                ]
              },
              time: Date.now()
            }),
            { status: 200 }
          );
        }

        if (url.pathname.endsWith('/v5/market/kline')) {
          const symbol = url.searchParams.get('symbol') ?? 'BTCUSDC';
          const interval = url.searchParams.get('interval') ?? '60';
          const limit = Number(url.searchParams.get('limit') ?? '100');
          const intervalMs = interval === '15' ? 15 * 60_000 : 60 * 60_000;

          const list =
            symbol === 'BTCUSDC'
              ? makeBybitKlines({ start: 100, delta: 0.1, limit, intervalMs })
              : makeBybitKlines({ start: 50, delta: 0.05, limit, intervalMs });

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
      bybitBaseUrl: 'https://mock.bybit.local',
      analysisCandleLimit: 100,
      topCandidates: 5
    };

    const app = createApp({ config });
    const response = await app.inject({ method: 'GET', url: '/api/scanner' });

    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      data: {
        count: number;
        candidates: Array<{ symbol: string; score: number }>;
      };
    };

    expect(body.data.count).toBeGreaterThan(0);
    expect(body.data.candidates[0]?.symbol).toBe('BTCUSDC');
    expect(body.data.candidates[0]?.score).toBeGreaterThan(0);

    await app.close();
  });
});
