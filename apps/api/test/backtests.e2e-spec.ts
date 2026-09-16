import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { MarketDataService } from './../src/modules/market-data/market-data.service.js';

function createCandle(index: number, price: number) {
  const openTime = new Date(Date.UTC(2026, 0, 1, index));
  const closeTime = new Date(Date.UTC(2026, 0, 1, index, 59, 59, 999));

  return {
    symbol: 'BTCUSDT',
    timeframe: 'H1',
    openTime,
    closeTime,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 1,
    brokerId: 'bybit',
    isClosed: true,
  };
}

describe('BacktestsController (e2e)', () => {
  let app: INestApplication;
  const marketDataService = {
    loadCandlesInRange: vi.fn(),
  };

  beforeAll(() => {
    process.env.BYBIT_ENABLED = 'false';
    process.env.TRADING212_ENABLED = 'false';
  });

  beforeEach(async () => {
    marketDataService.loadCandlesInRange.mockReset();
    marketDataService.loadCandlesInRange.mockResolvedValue([
      createCandle(0, 100),
      createCandle(1, 105),
      createCandle(2, 110),
      createCandle(3, 120),
      createCandle(4, 115),
    ]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MarketDataService)
      .useValue(marketDataService)
      .compile();

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
        startTime: '2026-01-01T00:00:00.000Z',
        endTime: '2026-01-01T04:59:59.999Z',
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
        startTime: '2026-01-01T00:00:00.000Z',
        endTime: '2026-01-01T04:59:59.999Z',
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
        startTime: '2026-01-01T00:00:00.000Z',
        endTime: '2026-01-01T04:59:59.999Z',
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
        endTime: '2026-01-01T04:59:59.999Z',
        initialCapital: 1000,
        feeRate: 0.001,
      })
      .expect(400);
  });

  it('returns an error when no candles are available', () => {
    marketDataService.loadCandlesInRange.mockResolvedValueOnce([]);

    return request(app.getHttpServer())
      .post('/api/backtests')
      .send({
        broker: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        strategyId: 'ema-crossover',
        startTime: '2026-01-01T00:00:00.000Z',
        endTime: '2026-01-01T04:59:59.999Z',
        initialCapital: 1000,
        feeRate: 0.001,
      })
      .expect(400);
  });
});
