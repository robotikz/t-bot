import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { vi } from 'vitest';

function createResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('MarketData (e2e)', () => {
  let app: INestApplication;
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    process.env.BYBIT_ENABLED = 'true';
    process.env.BYBIT_BASE_URL = 'https://api.bybit.com';
    process.env.BYBIT_TIMEOUT_MS = '10000';
    process.env.TRADING212_ENABLED = 'true';
    process.env.TRADING212_API_KEY = 'test-key';
    process.env.TRADING212_API_SECRET = 'test-secret';
    process.env.TRADING212_ENVIRONMENT = 'demo';
    process.env.TRADING212_BASE_URL = 'https://demo.trading212.com/api/v0';
    process.env.TRADING212_TIMEOUT_MS = '10000';
    process.env.MARKET_DATA_MAX_CANDLES = '10';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = new URL(input.toString());

        if (url.pathname.endsWith('/api/v0/equity/account/summary')) {
          return createResponse({
            id: 987654,
            currency: 'GBP',
            cash: {
              availableToTrade: 250,
              reservedForOrders: 25,
              inPies: 5,
            },
            investments: {
              currentValue: 1000,
              realizedProfitLoss: 50,
              totalCost: 900,
              unrealizedProfitLoss: 100,
            },
            totalValue: 1250,
          });
        }

        if (url.pathname.endsWith('/api/v0/equity/positions')) {
          return createResponse([]);
        }

        if (url.pathname.endsWith('/v5/market/instruments-info')) {
          const symbol = url.searchParams.get('symbol');
          return createResponse({
            retCode: 0,
            retMsg: 'OK',
            result: {
              category: 'spot',
              list: symbol
                ? [
                    {
                      symbol,
                      baseCoin: 'BTC',
                      quoteCoin: 'USDT',
                      status: 'Trading',
                    },
                  ]
                : [
                    {
                      symbol: 'BTCUSDT',
                      baseCoin: 'BTC',
                      quoteCoin: 'USDT',
                      status: 'Trading',
                    },
                    {
                      symbol: 'ETHUSDT',
                      baseCoin: 'ETH',
                      quoteCoin: 'USDT',
                      status: 'Trading',
                    },
                  ],
            },
          });
        }

        if (url.pathname.endsWith('/v5/market/kline')) {
          const end = url.searchParams.get('end');

          if (end) {
            return createResponse({
              retCode: 0,
              retMsg: 'OK',
              result: {
                category: 'spot',
                symbol: 'BTCUSDT',
                list: [['1700000000000', '100.0', '101.2', '99.5', '101.0', '10.0', '1010.0']],
              },
            });
          }

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
      }),
    );
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/market-data/markets (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/market-data/markets?broker=bybit')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toEqual([
          { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', active: true },
          { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', active: true },
        ]);
      });
  });

  it('/api/market-data/candles/load persists candles once and returns chronological data', async () => {
    await request(app.getHttpServer())
      .get('/api/market-data/candles/load?broker=bybit&symbol=BTCUSDT&timeframe=1h&limit=2')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toHaveLength(2);
        expect(body.data[0].openTime).toBe('2023-11-14T22:13:20.000Z');
        expect(body.data[1].openTime).toBe('2023-11-14T22:14:20.000Z');
      });

    await request(app.getHttpServer())
      .get('/api/market-data/candles/load?broker=bybit&symbol=BTCUSDT&timeframe=1h&limit=2')
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/market-data/candles?broker=bybit&symbol=BTCUSDT&timeframe=1h&limit=10')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toHaveLength(2);
        expect(body.data[0].openTime).toBe('2023-11-14T22:13:20.000Z');
        expect(body.data[1].openTime).toBe('2023-11-14T22:14:20.000Z');
      });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });
});
