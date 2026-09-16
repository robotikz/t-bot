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

describe('Strategies (e2e)', () => {
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
    process.env.MARKET_DATA_MAX_CANDLES = '50';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
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
          return createResponse({
            retCode: 0,
            retMsg: 'OK',
            result: {
              category: 'spot',
              list: [
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
              symbol: 'ETHUSDT',
              list: [
                ['1700000600000', '100.0', '101.0', '99.0', '100.0', '10.0', '1000.0'],
                ['1700000540000', '100.0', '101.0', '99.0', '100.0', '10.0', '1000.0'],
                ['1700000480000', '100.0', '101.0', '99.0', '100.0', '10.0', '1000.0'],
                ['1700000420000', '100.0', '101.0', '99.0', '100.0', '10.0', '1000.0'],
                ['1700000360000', '100.0', '101.0', '99.0', '100.0', '10.0', '1000.0'],
                ['1700000300000', '100.0', '101.0', '99.0', '100.0', '10.0', '1000.0'],
                ['1700000240000', '100.0', '101.0', '99.0', '100.0', '10.0', '1000.0'],
                ['1700000180000', '100.0', '101.0', '99.0', '100.0', '10.0', '1000.0'],
                ['1700000120000', '100.0', '101.0', '99.0', '100.0', '10.0', '1000.0'],
                ['1700000060000', '100.0', '101.0', '99.0', '100.0', '10.0', '1000.0'],
                ['1700000000000', '100.0', '101.0', '99.0', '100.0', '10.0', '1000.0'],
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

  it('/api/strategies (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/strategies')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toEqual([
          {
            id: 'ema-crossover',
            name: 'EMA Crossover',
            description: 'Generates signals from fast/slow EMA crossovers',
          },
          {
            id: 'rsi',
            name: 'RSI',
            description: 'Generates signals from RSI overbought/oversold levels',
          },
        ]);
      });
  });

  it('/api/strategies/:strategyId/evaluate (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/strategies/ema-crossover/evaluate?broker=bybit&symbol=ETHUSDT&timeframe=1h')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data.strategyId).toBe('ema-crossover');
        expect(body.data.symbol).toBe('ETHUSDT');
        expect(body.data.timeframe).toBe('H1');
        expect(body.data.type).toBe('HOLD');
        expect(body.data.indicators).toHaveProperty('emaFast');
        expect(body.data.indicators).toHaveProperty('emaSlow');
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
