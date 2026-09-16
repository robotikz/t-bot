import { Injectable } from '@nestjs/common';
import {
  BybitApiException,
  BybitHttpException,
  BybitMalformedResponseException,
  BybitNetworkException,
  BybitRequestTimeoutException,
} from './bybit.errors.js';
import {
  BYBIT_DEFAULT_TIMEOUT_MS,
  BYBIT_MAINNET_BASE_URL,
  BYBIT_TESTNET_BASE_URL,
} from './bybit.constants.js';
import {
  BybitApiEnvelope,
  BybitInstrumentsInfoResult,
  BybitKlineResult,
} from './bybit-api.types.js';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface BybitHttpClientOptions {
  baseUrl?: string;
  testnet?: boolean;
  timeoutMs?: number;
  apiKey?: string;
  apiSecret?: string;
  fetchImpl?: FetchLike;
}

@Injectable()
export class BybitHttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: BybitHttpClientOptions = {}) {
    this.baseUrl = options.baseUrl?.trim() || (options.testnet ? BYBIT_TESTNET_BASE_URL : BYBIT_MAINNET_BASE_URL);
    this.timeoutMs = options.timeoutMs ?? BYBIT_DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    void options.apiKey;
    void options.apiSecret;
  }

  async getInstrumentsInfo(category: string, symbol?: string): Promise<BybitApiEnvelope<BybitInstrumentsInfoResult>> {
    return this.request<BybitInstrumentsInfoResult>('/v5/market/instruments-info', {
      category,
      ...(symbol ? { symbol } : {}),
    });
  }

  async getKline(
    category: string,
    symbol: string,
    interval: string,
    limit?: number,
    end?: number,
  ): Promise<BybitApiEnvelope<BybitKlineResult>> {
    return this.request<BybitKlineResult>('/v5/market/kline', {
      category,
      symbol,
      interval,
      ...(typeof limit === 'number' ? { limit: String(limit) } : {}),
      ...(typeof end === 'number' ? { end: String(end) } : {}),
    });
  }

  private async request<T>(path: string, query: Record<string, string | undefined>): Promise<BybitApiEnvelope<T>> {
    const url = new URL(path, this.baseUrl);

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value);
      }
    }

    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<Response>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new BybitRequestTimeoutException(this.timeoutMs));
      }, this.timeoutMs);
    });

    try {
      const fetchPromise = this.fetchImpl(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        throw new BybitHttpException(response.status);
      }

      const rawBody = (await response.text()).trim();
      if (!rawBody) {
        throw new BybitMalformedResponseException('empty body');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody) as unknown;
      } catch {
        throw new BybitMalformedResponseException('invalid JSON');
      }

      if (!parsed || typeof parsed !== 'object' || !('retCode' in parsed) || !('result' in parsed)) {
        throw new BybitMalformedResponseException('missing retCode or result');
      }

      const envelope = parsed as BybitApiEnvelope<T>;
      if (typeof envelope.retCode !== 'number') {
        throw new BybitMalformedResponseException('invalid retCode');
      }

      if (envelope.retCode !== 0) {
        throw new BybitApiException(envelope.retCode, envelope.retMsg ?? 'Unknown error');
      }

      return envelope;
    } catch (error) {
      if (
        error instanceof BybitRequestTimeoutException ||
        error instanceof BybitHttpException ||
        error instanceof BybitApiException ||
        error instanceof BybitMalformedResponseException
      ) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new BybitRequestTimeoutException(this.timeoutMs);
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new BybitRequestTimeoutException(this.timeoutMs);
        }

        throw new BybitNetworkException(error.message);
      }

      throw new BybitNetworkException('unknown network failure');
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}
