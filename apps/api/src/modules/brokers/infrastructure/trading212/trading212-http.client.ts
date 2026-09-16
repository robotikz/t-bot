import { Injectable } from '@nestjs/common';
import {
  Trading212ConfigurationException,
  Trading212ForbiddenException,
  Trading212HttpException,
  Trading212MalformedResponseException,
  Trading212NetworkException,
  Trading212RateLimitException,
  Trading212RequestTimeoutException,
  Trading212UnauthorizedException,
} from './trading212.errors.js';
import {
  resolveTrading212BaseUrl,
  TRADING212_DEFAULT_TIMEOUT_MS,
} from './trading212.constants.js';
import {
  Trading212AccountSummaryResponse,
  Trading212PaginatedResponse,
  Trading212PositionResponse,
} from './trading212-api.types.js';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface Trading212HttpClientOptions {
  baseUrl?: string;
  environment?: string;
  timeoutMs?: number;
  apiKey?: string;
  apiSecret?: string;
  fetchImpl?: FetchLike;
}

@Injectable()
export class Trading212HttpClient {
  private readonly configuredBaseUrl: string;
  private readonly environment: string;
  private readonly timeoutMs: number;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: Trading212HttpClientOptions = {}) {
    this.configuredBaseUrl = options.baseUrl ?? '';
    this.environment = options.environment ?? 'demo';
    this.timeoutMs = options.timeoutMs ?? TRADING212_DEFAULT_TIMEOUT_MS;
    this.apiKey = options.apiKey ?? '';
    this.apiSecret = options.apiSecret ?? '';
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async getAccountSummary(): Promise<Trading212AccountSummaryResponse> {
    return this.requestJson<Trading212AccountSummaryResponse>('equity/account/summary');
  }

  async getPositions(ticker?: string): Promise<Trading212PositionResponse[]> {
    const query: Record<string, string> = {};
    if (ticker) {
      query.ticker = ticker;
    }

    return this.requestJson<Trading212PositionResponse[]>('equity/positions', query);
  }

  async getPaginated<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T[]> {
    const items: T[] = [];
    let nextPath = path;
    let nextQuery = query;

    while (nextPath) {
      const response = await this.requestJson<Trading212PaginatedResponse<T>>(nextPath, nextQuery);
      if (!response || typeof response !== 'object' || !Array.isArray(response.items)) {
        throw new Trading212MalformedResponseException('missing paginated items');
      }

      items.push(...response.items);

      if (!response.nextPagePath) {
        break;
      }

      const parsedNext = new URL(response.nextPagePath, this.resolveBaseUrl());
      nextPath = parsedNext.pathname;
      nextQuery = Object.fromEntries(parsedNext.searchParams.entries());
    }

    return items;
  }

  private async requestJson<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(path.replace(/^\/+/, ''), this.resolveBaseUrl());

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<Response>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new Trading212RequestTimeoutException(this.timeoutMs));
      }, this.timeoutMs);
    });

    try {
      const response = await Promise.race([
        this.fetchImpl(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            Authorization: this.buildAuthorizationHeader(),
          },
        }),
        timeoutPromise,
      ]);

      if (!response.ok) {
        await this.throwForHttpError(response);
      }

      const rawBody = (await response.text()).trim();
      if (!rawBody) {
        throw new Trading212MalformedResponseException('empty body');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody) as unknown;
      } catch {
        throw new Trading212MalformedResponseException('invalid JSON');
      }

      if (parsed === null || typeof parsed !== 'object') {
        throw new Trading212MalformedResponseException('unexpected response type');
      }

      return parsed as T;
    } catch (error) {
      if (
        error instanceof Trading212ConfigurationException ||
        error instanceof Trading212RequestTimeoutException ||
        error instanceof Trading212UnauthorizedException ||
        error instanceof Trading212ForbiddenException ||
        error instanceof Trading212RateLimitException ||
        error instanceof Trading212HttpException ||
        error instanceof Trading212MalformedResponseException
      ) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new Trading212RequestTimeoutException(this.timeoutMs);
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Trading212RequestTimeoutException(this.timeoutMs);
        }

        throw new Trading212NetworkException(error.message);
      }

      throw new Trading212NetworkException('unknown network failure');
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private async throwForHttpError(response: Response): Promise<never> {
    const rawBody = (await response.text()).trim();
    const message = this.extractErrorMessage(rawBody) ?? response.statusText;

    switch (response.status) {
      case 401:
        throw new Trading212UnauthorizedException(message || 'Trading212 unauthorized request');
      case 403:
        throw new Trading212ForbiddenException(message || 'Trading212 forbidden request');
      case 408:
        throw new Trading212RequestTimeoutException(this.timeoutMs);
      case 429:
        throw new Trading212RateLimitException(
          message || 'Trading212 rate limit exceeded',
          this.getRetryAfterMs(response.headers),
        );
      default:
        throw new Trading212HttpException(response.status, message);
    }
  }

  private getRetryAfterMs(headers: Headers): number | undefined {
    const resetValue = headers.get('x-ratelimit-reset');
    if (!resetValue) {
      return undefined;
    }

    const resetTimestamp = Number(resetValue);
    if (!Number.isFinite(resetTimestamp)) {
      return undefined;
    }

    return Math.max(0, resetTimestamp * 1000 - Date.now());
  }

  private extractErrorMessage(rawBody: string): string | undefined {
    if (!rawBody) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(rawBody) as unknown;
      if (typeof parsed === 'string') {
        return parsed;
      }

      if (parsed && typeof parsed === 'object') {
        const value = (parsed as { message?: unknown; error?: unknown }).message ?? (parsed as { error?: unknown }).error;
        if (typeof value === 'string' && value.trim()) {
          return value;
        }
      }
    } catch {
      return rawBody;
    }

    return rawBody;
  }

  private buildAuthorizationHeader(): string {
    if (!this.apiKey.trim() || !this.apiSecret.trim()) {
      throw new Trading212ConfigurationException('API key and API secret must be configured');
    }

    const token = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
    return `Basic ${token}`;
  }

  private resolveBaseUrl(): string {
    try {
      return resolveTrading212BaseUrl(this.environment, this.configuredBaseUrl);
    } catch (error) {
      throw new Trading212ConfigurationException(error instanceof Error ? error.message : 'invalid base URL');
    }
  }
}