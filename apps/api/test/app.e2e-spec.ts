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
    process.env.TRADING212_ENABLED = 'true';
    process.env.TRADING212_API_KEY = 'test-key';
    process.env.TRADING212_API_SECRET = 'test-secret';
    process.env.TRADING212_ENVIRONMENT = 'demo';
    process.env.TRADING212_BASE_URL = 'https://demo.trading212.com/api/v0';
    process.env.TRADING212_TIMEOUT_MS = '10000';

    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(input.toString());

      if (url.pathname.endsWith('/api/v0/equity/account/summary')) {
        expect(url.origin).toBe('https://demo.trading212.com');
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
        expect(init?.headers).toMatchObject({
          Authorization: 'Basic dGVzdC1rZXk6dGVzdC1zZWNyZXQ=',
        });
        return createResponse([
          {
            quantity: 5,
            averagePricePaid: 100,
            currentPrice: 110,
            instrument: { ticker: 'VUSA_LN', currencyCode: 'GBP', name: 'Vanguard S&P 500 UCITS ETF' },
            quantityAvailableForTrading: 5,
            walletImpact: {
              currency: 'GBP',
              currentValue: 550,
              totalCost: 500,
              unrealizedProfitLoss: 50,
            },
          },
        ]);
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
        expect(body.data.some((broker: { id: string }) => broker.id === 'trading212')).toBe(true);
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

  it('/api/brokers/trading212/capabilities exposes only account', () => {
    return request(app.getHttpServer())
      .get('/api/brokers/trading212/capabilities')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toEqual(['account']);
      });
  });

  it('/api/brokers/trading212/account returns the account summary', () => {
    return request(app.getHttpServer())
      .get('/api/brokers/trading212/account')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toMatchObject({
          id: '987654',
          brokerId: 'trading212',
          currency: 'GBP',
          cash: 280,
          investedValue: 1000,
          totalValue: 1250,
        });
      });
  });

  it('/api/brokers/trading212/balances returns the cash balance', () => {
    return request(app.getHttpServer())
      .get('/api/brokers/trading212/balances')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toEqual([
          {
            asset: 'GBP',
            free: 250,
            locked: 30,
          },
        ]);
      });
  });

  it('/api/brokers/trading212/positions returns open positions', () => {
    return request(app.getHttpServer())
      .get('/api/brokers/trading212/positions')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(body.data).toEqual([
          {
            symbol: 'VUSA_LN',
            size: 5,
            entryPrice: 100,
            currentPrice: 110,
            marketValue: 550,
            currency: 'GBP',
            availableQuantity: 5,
            unrealizedPnl: 50,
          },
        ]);
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
