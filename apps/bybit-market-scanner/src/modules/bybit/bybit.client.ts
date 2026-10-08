import { ExternalServiceError } from '../../shared/errors/app-error.js';
import { MemoryCache } from '../../shared/utils/cache.js';
import { logger } from '../../shared/utils/logger.js';
import type { AppConfig } from '../../config/config.js';
import type {
  BybitInstrumentsResult,
  BybitInstrument,
  BybitKline,
  BybitKlinesResult,
  BybitResponse,
  BybitTicker,
  BybitTickersResult
} from './bybit.types.js';

interface RequestOptions {
  retries?: number;
  timeoutMs?: number;
}

export class BybitClient {
  private readonly cache = new MemoryCache<unknown>();
  private readonly baseUrl: string;

  constructor(private readonly config: AppConfig) {
    this.baseUrl = this.normalizeBaseUrl(config.bybitBaseUrl);
  }

  async getSpotInstruments(): Promise<BybitInstrument[]> {
    const cacheKey = 'spot:instruments';
    const cached = this.cache.get(cacheKey) as BybitInstrument[] | undefined;
    if (cached) return cached;

    const response = await this.request<BybitInstrumentsResult>('/v5/market/instruments-info', {
      category: 'spot'
    });

    const list = response.result.list;
    this.cache.set(cacheKey, list, this.config.instrumentsCacheTtlMs);

    const trading = list.filter((item) => item.status === 'Trading');
    const usdcInstruments = trading.filter((item) => item.quoteCoin?.toUpperCase() === 'USDC').length;
    const usdtInstruments = trading.filter((item) => item.quoteCoin?.toUpperCase() === 'USDT').length;

    logger.info('bybit spot instruments loaded', {
      bybitApiBaseUrl: this.baseUrl,
      spotInstrumentsLoaded: list.length,
      tradingInstrumentsLoaded: trading.length,
      usdcInstruments,
      usdtInstruments
    });

    return list;
  }

  async getSpotTickers(): Promise<BybitTicker[]> {
    const cacheKey = 'spot:tickers';
    const cached = this.cache.get(cacheKey) as BybitTicker[] | undefined;
    if (cached) return cached;

    const response = await this.request<BybitTickersResult>('/v5/market/tickers', { category: 'spot' });
    const list = response.result.list;
    this.cache.set(cacheKey, list, this.config.tickersCacheTtlMs);
    return list;
  }

  async getSpotTicker(symbol: string): Promise<BybitTicker | undefined> {
    const response = await this.request<BybitTickersResult>('/v5/market/tickers', {
      category: 'spot',
      symbol
    });

    return response.result.list.find((item) => item.symbol === symbol);
  }

  async getKlines(symbol: string, interval: string, limit: number): Promise<BybitKline[]> {
    const cacheKey = `spot:klines:${symbol}:${interval}:${limit}`;
    const cached = this.cache.get(cacheKey) as BybitKline[] | undefined;
    if (cached) return cached;

    const response = await this.request<BybitKlinesResult>('/v5/market/kline', {
      category: 'spot',
      symbol,
      interval,
      limit: String(limit)
    });

    const list = response.result.list;
    this.cache.set(cacheKey, list, this.config.candlesCacheTtlMs);
    return list;
  }

  private async request<T>(
    path: string,
    query: Record<string, string>,
    options: RequestOptions = {}
  ): Promise<BybitResponse<T>> {
    const retries = options.retries ?? 2;
    const timeoutMs = options.timeoutMs ?? 8000;

    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const url = new URL(path, this.baseUrl);
        for (const [key, value] of Object.entries(query)) {
          url.searchParams.set(key, value);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }
        });

        clearTimeout(timeout);

        if (response.status === 429) {
          throw new ExternalServiceError('Bybit rate limit exceeded', 'RATE_LIMIT', 429);
        }

        if (!response.ok) {
          throw new ExternalServiceError(`Bybit HTTP error: ${response.status}`, 'BYBIT_HTTP_ERROR', 502);
        }

        const json = (await response.json()) as BybitResponse<T>;
        if (json.retCode !== 0) {
          throw new ExternalServiceError(
            `Bybit API error (${json.retCode}): ${json.retMsg}`,
            'BYBIT_API_ERROR',
            502
          );
        }

        return json;
      } catch (error) {
        lastError = error;
        if (attempt === retries) break;
        const backoffMs = 300 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    if (lastError instanceof ExternalServiceError) {
      throw lastError;
    }

    if (lastError instanceof Error && lastError.name === 'AbortError') {
      throw new ExternalServiceError('Bybit request timeout', 'BYBIT_TIMEOUT', 504);
    }

    throw new ExternalServiceError('Failed to reach Bybit', 'BYBIT_UNAVAILABLE', 502);
  }

  private normalizeBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.trim();
    if (!trimmed) {
      return 'https://api.bybit.eu/';
    }

    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }
}
