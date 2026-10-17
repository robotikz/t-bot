import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';

describe('BacktestsController (e2e)', () => {
  let app: INestApplication;
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    process.env.DATABASE_URL = '';
    process.env.BYBIT_ENABLED = 'true';
    process.env.BYBIT_API_BASE_URL = 'https://api.bybit.eu';
    process.env.BYBIT_BASE_URL = 'https://api.bybit.eu';
    process.env.BYBIT_TIMEOUT_MS = '10000';
    process.env.TRADING212_ENABLED = 'false';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = new URL(input.toString());

        if (url.pathname.endsWith('/v5/market/instruments-info')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
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
                    },
                  ],
                },
              }),
          } as Response;
        }

        if (url.pathname.endsWith('/v5/market/kline')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                retCode: 0,
                retMsg: 'OK',
                result: {
                  category: 'spot',
                  symbol: 'BTCUSDT',
                  list: [
                    ['1704081600000', '115.0', '116.0', '114.0', '115.0', '10.0', '1150.0'],
                    ['1704078000000', '110.0', '111.0', '109.0', '110.0', '10.0', '1100.0'],
                    ['1704074400000', '105.0', '106.0', '104.0', '105.0', '10.0', '1050.0'],
                    ['1704070800000', '102.0', '103.0', '101.0', '102.0', '10.0', '1020.0'],
                    ['1704067200000', '100.0', '101.0', '99.0', '100.0', '10.0', '1000.0'],
                  ],
                },
              }),
          } as Response;
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

  it('runs a valid backtest', () => {
    return request(app.getHttpServer())
      .post('/api/backtests')
      .send({
        broker: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        strategyId: 'ema-crossover',
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T04:59:59.999Z',
        initialCapital: 1000,
        feeRate: 0.001,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data.metrics.initialCapital).toBe(1000);
        expect(Array.isArray(body.data.trades)).toBe(true);
        expect(Array.isArray(body.data.equityCurve)).toBe(true);
        expect(Array.isArray(body.data.signals)).toBe(true);
      });
  });

  it('rejects invalid strategy ids', () => {
    return request(app.getHttpServer())
      .post('/api/backtests')
      .send({
        broker: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        strategyId: 'missing',
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T04:59:59.999Z',
        initialCapital: 1000,
        feeRate: 0.001,
      })
      .expect(404);
  });

  it('validates capital and fee values', () => {
    return request(app.getHttpServer())
      .post('/api/backtests')
      .send({
        broker: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        strategyId: 'ema-crossover',
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T04:59:59.999Z',
        initialCapital: 0,
        feeRate: 1.5,
      })
      .expect(400);
  });

  it('rejects invalid dates', () => {
    return request(app.getHttpServer())
      .post('/api/backtests')
      .send({
        broker: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        strategyId: 'ema-crossover',
        startTime: 'invalid-date',
        endTime: '2024-01-01T04:59:59.999Z',
        initialCapital: 1000,
        feeRate: 0.001,
      })
      .expect(400);
  });

  it('returns an error when no candles are available', () => {
    return request(app.getHttpServer())
      .post('/api/backtests')
      .send({
        broker: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        strategyId: 'ema-crossover',
        startTime: '2030-01-01T00:00:00.000Z',
        endTime: '2030-01-01T04:59:59.999Z',
        initialCapital: 1000,
        feeRate: 0.001,
      })
      .expect(400);
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
