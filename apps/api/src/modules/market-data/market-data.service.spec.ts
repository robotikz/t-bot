import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BrokerCapability } from '../brokers/domain/broker-capability.js';
import { BrokerType, Timeframe } from '../brokers/domain/types.js';
import { BrokerManager } from '../brokers/application/broker-manager.js';
import { InMemoryBrokerAdapter } from '../brokers/infrastructure/in-memory-adapter.js';
import { MarketDataService } from './market-data.service.js';

describe('MarketDataService', () => {
  function createService(dependencies?: {
    brokerManager?: BrokerManager;
    candleRepository?: {
      upsertMany: ReturnType<typeof vi.fn>;
      findByBrokerSymbolTimeframe: ReturnType<typeof vi.fn>;
    };
    configService?: { getNumber: ReturnType<typeof vi.fn> };
  }) {
    const brokerManager = dependencies?.brokerManager ?? new BrokerManager();
    const candleRepository = dependencies?.candleRepository ?? {
      upsertMany: vi.fn(async () => []),
      findByBrokerSymbolTimeframe: vi.fn(async () => []),
    };
    const configService = dependencies?.configService ?? { getNumber: vi.fn(() => 100) };

    return {
      service: new MarketDataService(brokerManager, candleRepository as never, configService as never),
      candleRepository,
      configService,
      brokerManager,
    };
  }

  it('throws for unknown broker when checking market data capability', async () => {
    const { service } = createService();

    await expect(service.getMarkets('missing')).rejects.toThrow();
  });

  it('throws for broker without market-data capability', async () => {
    const { service, brokerManager } = createService();
    brokerManager.register(new InMemoryBrokerAdapter('trading212', 'Trading212', BrokerType.STOCK_BROKER, [BrokerCapability.ACCOUNT]));

    await expect(service.getMarkets('trading212')).rejects.toThrow();
  });

  it('fetches candles from the broker and returns chronological results', async () => {
    const { service, brokerManager } = createService();
    const fetchSpy = vi.fn(async () => [
      {
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        openTime: new Date('2026-09-16T11:00:00.000Z'),
        closeTime: new Date('2026-09-16T11:59:59.999Z'),
        open: 105,
        high: 115,
        low: 100,
        close: 110,
        volume: 20,
      },
      {
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        openTime: new Date('2026-09-16T10:00:00.000Z'),
        closeTime: new Date('2026-09-16T10:59:59.999Z'),
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 25,
      },
    ]);

    brokerManager.register(
      new InMemoryBrokerAdapter('bybit', 'Bybit', BrokerType.CRYPTO_EXCHANGE, [BrokerCapability.MARKET_DATA], {
        getMarkets: vi.fn(async () => [{ symbol: 'BTCUSDT' }]),
        getInstrument: vi.fn(async () => null),
        getCandles: fetchSpy,
      }),
    );

    const candles = await service.fetchCandles({ brokerId: 'bybit', symbol: 'BTCUSDT', timeframe: Timeframe.H1, limit: 2 });

    expect(fetchSpy).toHaveBeenCalledWith('BTCUSDT', Timeframe.H1, 2, { beforeOpenTime: undefined });
    expect(candles[0].openTime.toISOString()).toBe('2026-09-16T10:00:00.000Z');
    expect(candles[1].openTime.toISOString()).toBe('2026-09-16T11:00:00.000Z');
  });

  it('ingests candles idempotently and normalizes duplicates', async () => {
    const { service, candleRepository } = createService();
    const candles = [
      {
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        openTime: new Date('2026-09-16T11:00:00.000Z'),
        closeTime: new Date('2026-09-16T11:59:59.999Z'),
        open: 105,
        high: 115,
        low: 100,
        close: 110,
        volume: 20,
      },
      {
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        openTime: new Date('2026-09-16T11:00:00.000Z'),
        closeTime: new Date('2026-09-16T11:59:59.999Z'),
        open: 105,
        high: 115,
        low: 100,
        close: 110,
        volume: 20,
      },
      {
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        openTime: new Date('2026-09-16T10:00:00.000Z'),
        closeTime: new Date('2026-09-16T10:59:59.999Z'),
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 25,
      },
    ];

    const persisted = await service.ingestCandles({ brokerId: 'bybit', symbol: 'BTCUSDT', timeframe: Timeframe.H1, candles });

    expect(persisted).toHaveLength(2);
    expect(candleRepository.upsertMany).toHaveBeenCalledTimes(1);
    expect(candleRepository.upsertMany.mock.calls[0][0]).toHaveLength(2);
    expect(candleRepository.upsertMany.mock.calls[0][0][0].openTime.toISOString()).toBe('2026-09-16T10:00:00.000Z');
  });

  it('reads stored candles in chronological order and marks open candles', async () => {
    const { service, candleRepository } = createService();
    candleRepository.findByBrokerSymbolTimeframe.mockResolvedValue([
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        openTime: new Date('2024-09-16T11:00:00.000Z'),
        closeTime: new Date('2024-09-16T11:59:59.999Z'),
        open: 105,
        high: 115,
        low: 100,
        close: 110,
        volume: 20,
      },
      {
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        openTime: new Date('2024-09-16T10:00:00.000Z'),
        closeTime: new Date('2024-09-16T10:59:59.999Z'),
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 25,
      },
    ]);

    const candles = await service.getCandles({ brokerId: 'bybit', symbol: 'BTCUSDT', timeframe: Timeframe.H1, limit: 2 });

    expect(candles[0].openTime.toISOString()).toBe('2024-09-16T10:00:00.000Z');
    expect(candles[0].isClosed).toBe(true);
    expect(candles[1].isClosed).toBe(true);
  });

  it('rejects invalid candles', async () => {
    const { service } = createService();

    await expect(
      service.ingestCandles({
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: Timeframe.H1,
        candles: [
          {
            symbol: 'BTCUSDT',
            timeframe: Timeframe.H1,
            openTime: new Date('2026-09-16T10:00:00.000Z'),
            closeTime: new Date('2026-09-16T10:59:59.999Z'),
            open: -1,
            high: 110,
            low: 95,
            close: 105,
            volume: 25,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsupported timeframes', async () => {
    const { service } = createService();

    await expect(
      service.ingestCandles({
        brokerId: 'bybit',
        symbol: 'BTCUSDT',
        timeframe: 'BAD' as Timeframe,
        candles: [
          {
            symbol: 'BTCUSDT',
            timeframe: 'BAD' as Timeframe,
            openTime: new Date('2026-09-16T10:00:00.000Z'),
            closeTime: new Date('2026-09-16T10:59:59.999Z'),
            open: 100,
            high: 110,
            low: 95,
            close: 105,
            volume: 25,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces the configured candle limit', async () => {
    const { service, brokerManager } = createService({ configService: { getNumber: vi.fn(() => 2) } });
    const getCandles = vi.fn(async () => []);
    brokerManager.register(
      new InMemoryBrokerAdapter('bybit', 'Bybit', BrokerType.CRYPTO_EXCHANGE, [BrokerCapability.MARKET_DATA], {
        getMarkets: vi.fn(async () => []),
        getInstrument: vi.fn(async () => null),
        getCandles,
      }),
    );

    await expect(
      service.fetchCandles({ brokerId: 'bybit', symbol: 'BTCUSDT', timeframe: Timeframe.H1, limit: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
