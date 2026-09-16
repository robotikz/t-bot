import { describe, expect, it, vi } from 'vitest';
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
import { Trading212HttpClient } from './trading212-http.client.js';

function createResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; statusText?: string; headers?: Record<string, string> } = {},
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: new Headers(init.headers),
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

describe('Trading212HttpClient', () => {
  it('performs a successful request with basic auth', async () => {
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(input.toString()).toBe('https://demo.trading212.com/api/v0/equity/account/summary');
      expect(init?.method).toBe('GET');
      expect(init?.headers).toMatchObject({
        Accept: 'application/json',
        Authorization: 'Basic dGVzdC1rZXk6dGVzdC1zZWNyZXQ=',
      });

      return createResponse({
        id: 123,
        currency: 'GBP',
        cash: { availableToTrade: 10, reservedForOrders: 1, inPies: 2 },
        investments: { currentValue: 100, realizedProfitLoss: 1, totalCost: 90, unrealizedProfitLoss: 10 },
        totalValue: 110,
      });
    });

    const client = new Trading212HttpClient({
      environment: 'demo',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const response = await client.getAccountSummary();
    expect(response.id).toBe(123);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws on unauthorized responses', async () => {
    const fetchImpl = vi.fn(async () => createResponse('nope', { ok: false, status: 401, statusText: 'Unauthorized' }));
    const client = new Trading212HttpClient({ apiKey: 'a', apiSecret: 'b', fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.getAccountSummary()).rejects.toBeInstanceOf(Trading212UnauthorizedException);
  });

  it('throws on forbidden responses', async () => {
    const fetchImpl = vi.fn(async () => createResponse('forbidden', { ok: false, status: 403, statusText: 'Forbidden' }));
    const client = new Trading212HttpClient({ apiKey: 'a', apiSecret: 'b', fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.getAccountSummary()).rejects.toBeInstanceOf(Trading212ForbiddenException);
  });

  it('throws on rate limit responses', async () => {
    const fetchImpl = vi.fn(async () => createResponse('limited', { ok: false, status: 429, statusText: 'Too Many Requests' }));
    const client = new Trading212HttpClient({ apiKey: 'a', apiSecret: 'b', fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.getAccountSummary()).rejects.toBeInstanceOf(Trading212RateLimitException);
  });

  it('throws on HTTP errors', async () => {
    const fetchImpl = vi.fn(async () => createResponse('boom', { ok: false, status: 500, statusText: 'Internal Server Error' }));
    const client = new Trading212HttpClient({ apiKey: 'a', apiSecret: 'b', fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.getAccountSummary()).rejects.toBeInstanceOf(Trading212HttpException);
  });

  it('times out cleanly', async () => {
    const fetchImpl = vi.fn(async () => new Promise<Response>(() => undefined));
    const client = new Trading212HttpClient({ apiKey: 'a', apiSecret: 'b', fetchImpl, timeoutMs: 5 });

    await expect(client.getAccountSummary()).rejects.toBeInstanceOf(Trading212RequestTimeoutException);
  });

  it('throws on network failures', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const client = new Trading212HttpClient({ apiKey: 'a', apiSecret: 'b', fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.getAccountSummary()).rejects.toBeInstanceOf(Trading212NetworkException);
  });

  it('throws on malformed responses', async () => {
    const fetchImpl = vi.fn(async () => createResponse('', { ok: true, status: 200 }));
    const client = new Trading212HttpClient({ apiKey: 'a', apiSecret: 'b', fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.getAccountSummary()).rejects.toBeInstanceOf(Trading212MalformedResponseException);
  });

  it('fails cleanly when credentials are missing', async () => {
    const client = new Trading212HttpClient({ fetchImpl: vi.fn(async () => createResponse({})) as unknown as typeof fetch });

    await expect(client.getAccountSummary()).rejects.toBeInstanceOf(Trading212ConfigurationException);
  });

  it('fails cleanly for invalid configuration', async () => {
    const client = new Trading212HttpClient({
      environment: 'staging',
      apiKey: 'a',
      apiSecret: 'b',
      fetchImpl: vi.fn(async () => createResponse({})) as unknown as typeof fetch,
    });

    await expect(client.getAccountSummary()).rejects.toBeInstanceOf(Trading212ConfigurationException);
  });
});