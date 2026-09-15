import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { vi } from 'vitest';

function createResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('AppController (e2e)', () => {
  let app: INestApplication;
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    process.env.BYBIT_ENABLED = 'true';
    process.env.BYBIT_BASE_URL = 'https://api.bybit.com';
    process.env.BYBIT_TIMEOUT_MS = '10000';

    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = new URL(input.toString());

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
                    priceFilter: { tickSize: '0.10' },
                    lotSizeFilter: { qtyStep: '0.00001000' },
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
    }));
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('ok');
      });
  });

  it('/api/brokers exposes Bybit', () => {
    return request(app.getHttpServer())
      .get('/api/brokers')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data.some((broker: { id: string }) => broker.id === 'bybit')).toBe(true);
      });
  });

  it('/api/brokers/bybit/capabilities exposes only market data', () => {
    return request(app.getHttpServer())
      .get('/api/brokers/bybit/capabilities')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toEqual(['market_data']);
      });
  });

  it('/api/brokers/bybit/markets returns market data', () => {
    return request(app.getHttpServer())
      .get('/api/brokers/bybit/markets')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toEqual([
          {
            symbol: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            active: true,
          },
          {
            symbol: 'ETHUSDT',
            baseAsset: 'ETH',
            quoteAsset: 'USDT',
            active: true,
          },
        ]);
      });
  });

  it('/api/brokers/bybit/markets/BTCUSDT returns instrument details', () => {
    return request(app.getHttpServer())
      .get('/api/brokers/bybit/markets/BTCUSDT')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toMatchObject({
          symbol: 'BTCUSDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          active: true,
          status: 'Trading',
        });
      });
  });

  it('/api/brokers/bybit/candles returns chronological candles', () => {
    return request(app.getHttpServer())
      .get('/api/brokers/bybit/candles?symbol=BTCUSDT&timeframe=1h&limit=2')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toHaveLength(2);
        expect(body.data[0].symbol).toBe('BTCUSDT');
        expect(body.data[0].timeframe).toBe('H1');
        expect(body.data[0].open).toBe(100);
        expect(body.data[1].open).toBe(101.5);
      });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });
});
