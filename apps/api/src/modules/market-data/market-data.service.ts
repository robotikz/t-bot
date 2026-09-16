import { BadRequestException, Injectable } from '@nestjs/common';
import { BrokerManager } from '../brokers/application/broker-manager.js';
import { CandleRepository } from '../candles/candle.repository.js';
import { ConfigService } from '../config/config.service.js';
import { Candle, Timeframe } from '../brokers/domain/types.js';
import { MARKET_DATA_DEFAULT_PAGE_SIZE } from './market-data.constants.js';

type FetchCandlesRequest = {
  brokerId: string;
  symbol: string;
  timeframe: Timeframe;
  limit?: number;
  beforeOpenTime?: Date;
};

type ReadCandlesRangeRequest = {
  brokerId: string;
  symbol: string;
  timeframe: Timeframe;
  startTime: Date;
  endTime: Date;
};

type IngestCandlesRequest = {
  brokerId: string;
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
};

type StoredCandle = Candle & { brokerId: string; isClosed: boolean };
type StoredCandleRow = {
  brokerId?: string;
  symbol: string;
  timeframe: string;
  openTime: Date;
  closeTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

@Injectable()
export class MarketDataService {
  constructor(
    private readonly brokerManager: BrokerManager,
    private readonly candleRepository: CandleRepository,
    private readonly configService: ConfigService,
  ) {}

  async getMarkets(brokerId: string) {
    return this.brokerManager.getMarketDataProvider(brokerId).getMarkets();
  }

  async fetchCandles(request: FetchCandlesRequest): Promise<StoredCandle[]> {
    const limit = this.resolveLimit(request.limit);
    const provider = this.brokerManager.getMarketDataProvider(request.brokerId);
    const candles = await provider.getCandles(request.symbol, request.timeframe, limit, {
      beforeOpenTime: request.beforeOpenTime,
    });

    return this.decorateCandles(request.brokerId, candles);
  }

  async ingestCandles(request: IngestCandlesRequest): Promise<StoredCandle[]> {
    this.assertCandlesMatchRequest(request);

    const normalizedCandles = this.normalizeCandles(request.brokerId, request.candles);
    await this.candleRepository.upsertMany(normalizedCandles);

    return normalizedCandles;
  }

  async getCandles(request: FetchCandlesRequest): Promise<StoredCandle[]> {
    const limit = this.resolveLimit(request.limit);
    const candles = await this.candleRepository.findByBrokerSymbolTimeframe({
      brokerId: request.brokerId,
      symbol: request.symbol,
      timeframe: request.timeframe,
      limit,
    });

    return this.decorateStoredCandles(request.brokerId, candles);
  }

  async getCandlesInRange(request: ReadCandlesRangeRequest): Promise<StoredCandle[]> {
    if (!(request.startTime instanceof Date) || Number.isNaN(request.startTime.getTime())) {
      throw new BadRequestException('startTime must be a valid date');
    }

    if (!(request.endTime instanceof Date) || Number.isNaN(request.endTime.getTime())) {
      throw new BadRequestException('endTime must be a valid date');
    }

    if (request.startTime.getTime() >= request.endTime.getTime()) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const candles = await this.candleRepository.findByBrokerSymbolTimeframeRange({
      brokerId: request.brokerId,
      symbol: request.symbol,
      timeframe: request.timeframe,
      startTime: request.startTime,
      endTime: request.endTime,
    });

    return this.decorateStoredCandles(request.brokerId, candles);
  }

  async loadCandles(request: FetchCandlesRequest): Promise<StoredCandle[]> {
    const limit = this.resolveLimit(request.limit);
    const provider = this.brokerManager.getMarketDataProvider(request.brokerId);
    const pageSize = Math.min(MARKET_DATA_DEFAULT_PAGE_SIZE, limit);
    const fetchedCandles: Candle[] = [];

    let beforeOpenTime = request.beforeOpenTime;
    while (fetchedCandles.length < limit) {
      const remaining = limit - fetchedCandles.length;
      const currentLimit = Math.min(pageSize, remaining);
      const page = await provider.getCandles(request.symbol, request.timeframe, currentLimit, {
        beforeOpenTime,
      });

      if (!page.length) {
        break;
      }

      const normalizedPage = this.sortCandles(page);
      fetchedCandles.push(...normalizedPage);

      if (page.length < currentLimit) {
        break;
      }

      beforeOpenTime = normalizedPage[0]?.openTime;
      if (!beforeOpenTime) {
        break;
      }
    }

    return this.ingestCandles({
      brokerId: request.brokerId,
      symbol: request.symbol,
      timeframe: request.timeframe,
      candles: fetchedCandles,
    });
  }

  async loadCandlesInRange(request: ReadCandlesRangeRequest): Promise<StoredCandle[]> {
    if (!(request.startTime instanceof Date) || Number.isNaN(request.startTime.getTime())) {
      throw new BadRequestException('startTime must be a valid date');
    }

    if (!(request.endTime instanceof Date) || Number.isNaN(request.endTime.getTime())) {
      throw new BadRequestException('endTime must be a valid date');
    }

    if (request.startTime.getTime() >= request.endTime.getTime()) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const maxCandles = this.configService.getNumber('MARKET_DATA_MAX_CANDLES', 500);
    const pageSize = Math.min(MARKET_DATA_DEFAULT_PAGE_SIZE, maxCandles);
    const provider = this.brokerManager.getMarketDataProvider(request.brokerId);
    const fetchedCandles: Candle[] = [];
    let beforeOpenTime = new Date(request.endTime.getTime() + 1);

    while (fetchedCandles.length < maxCandles) {
      const remaining = maxCandles - fetchedCandles.length;
      const currentLimit = Math.min(pageSize, remaining);
      const page = await provider.getCandles(request.symbol, request.timeframe, currentLimit, { beforeOpenTime });

      if (!page.length) {
        break;
      }

      const normalizedPage = this.sortCandles(page);
      fetchedCandles.push(...normalizedPage);

      const oldestCandle = normalizedPage[0];
      if (!oldestCandle) {
        break;
      }

      if (oldestCandle.openTime.getTime() <= request.startTime.getTime() || page.length < currentLimit) {
        break;
      }

      beforeOpenTime = oldestCandle.openTime;
    }

    await this.ingestCandles({
      brokerId: request.brokerId,
      symbol: request.symbol,
      timeframe: request.timeframe,
      candles: fetchedCandles,
    });

    return this.getCandlesInRange(request);
  }

  private resolveLimit(limit?: number): number {
    const maxCandles = this.configService.getNumber('MARKET_DATA_MAX_CANDLES', 500);
    const resolvedLimit = limit ?? maxCandles;

    if (resolvedLimit < 1) {
      throw new BadRequestException('limit must be at least 1');
    }

    if (resolvedLimit > maxCandles) {
      throw new BadRequestException(`limit must not exceed ${maxCandles}`);
    }

    return resolvedLimit;
  }

  private assertCandlesMatchRequest(request: IngestCandlesRequest) {
    for (const candle of request.candles) {
      if (!candle.symbol) {
        throw new BadRequestException('candle symbol is required');
      }

      if (candle.symbol !== request.symbol) {
        throw new BadRequestException('candle symbol does not match request symbol');
      }

      if (candle.timeframe !== request.timeframe) {
        throw new BadRequestException('candle timeframe does not match request timeframe');
      }
    }
  }

  private normalizeCandles(brokerId: string, candles: Candle[]): StoredCandle[] {
    const sortedCandles = this.sortCandles(candles);
    const now = Date.now();
    const uniqueCandles = new Map<string, StoredCandle>();

    for (const candle of sortedCandles) {
      this.validateCandle(candle);
      const storedCandle: StoredCandle = {
        ...candle,
        brokerId,
        isClosed: candle.closeTime.getTime() <= now,
      };

      uniqueCandles.set(this.candleIdentity(storedCandle), storedCandle);
    }

    return Array.from(uniqueCandles.values()).sort((left, right) => left.openTime.getTime() - right.openTime.getTime());
  }

  private decorateCandles(brokerId: string, candles: Candle[]): StoredCandle[] {
    return this.normalizeCandles(brokerId, candles);
  }

  private decorateStoredCandles(brokerId: string, candles: StoredCandleRow[]): StoredCandle[] {
    const now = Date.now();
    return candles
      .map((candle) => ({
        ...candle,
        brokerId: candle.brokerId ?? brokerId,
        timeframe: candle.timeframe as Timeframe,
        isClosed: candle.closeTime.getTime() <= now,
      }))
      .sort((left, right) => left.openTime.getTime() - right.openTime.getTime());
  }

  private validateCandle(candle: Candle) {
    if (!candle.symbol) {
      throw new BadRequestException('candle symbol is required');
    }

    if (!Object.values(Timeframe).includes(candle.timeframe)) {
      throw new BadRequestException(`unsupported timeframe ${candle.timeframe}`);
    }

    if (!(candle.openTime instanceof Date) || Number.isNaN(candle.openTime.getTime())) {
      throw new BadRequestException('invalid candle openTime');
    }

    if (!(candle.closeTime instanceof Date) || Number.isNaN(candle.closeTime.getTime())) {
      throw new BadRequestException('invalid candle closeTime');
    }

    const values = [candle.open, candle.high, candle.low, candle.close, candle.volume];
    if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      throw new BadRequestException('candle numeric values must be finite and non-negative');
    }

    if (candle.high < candle.low) {
      throw new BadRequestException('candle high must be greater than or equal to low');
    }

    if (candle.high < candle.open || candle.high < candle.close) {
      throw new BadRequestException('candle high must be greater than or equal to open and close');
    }

    if (candle.low > candle.open || candle.low > candle.close) {
      throw new BadRequestException('candle low must be less than or equal to open and close');
    }

    if (candle.closeTime.getTime() <= candle.openTime.getTime()) {
      throw new BadRequestException('candle closeTime must be after openTime');
    }
  }

  private sortCandles(candles: Candle[]) {
    return [...candles].sort((left, right) => left.openTime.getTime() - right.openTime.getTime());
  }

  private candleIdentity(candle: Candle & { brokerId: string }) {
    return [candle.brokerId, candle.symbol, candle.timeframe, candle.openTime.toISOString()].join('::');
  }
}
