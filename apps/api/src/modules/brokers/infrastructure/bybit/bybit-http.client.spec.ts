import { describe, expect, it, vi } from 'vitest';
import { BybitApiException } from './bybit.errors.js';
import { BybitHttpClient } from './bybit-http.client.js';

function createResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

describe('BybitHttpClient', () => {
  it('performs a successful request', async () => {
    const fetchImpl = vi.fn(async () =>
      createResponse({
        retCode: 0,
        retMsg: 'OK',
        result: { category: 'spot', list: [] },
      }),
    );

    const client = new BybitHttpClient({ fetchImpl });
    const response = await client.getInstrumentsInfo('spot');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(response.retCode).toBe(0);
    expect(response.result.category).toBe('spot');
  });

  it('throws on HTTP errors', async () => {
    const fetchImpl = vi.fn(async () => createResponse('boom', { ok: false, status: 500 }));
    const client = new BybitHttpClient({ fetchImpl });

    await expect(client.getInstrumentsInfo('spot')).rejects.toThrow(/HTTP error 500/);
  });

  it('throws on Bybit API errors', async () => {
    const fetchImpl = vi.fn(async () =>
      createResponse({
        retCode: 10001,
        retMsg: 'symbol invalid',
        result: { category: 'spot', list: [] },
      }),
    );
    const client = new BybitHttpClient({ fetchImpl });

    await expect(client.getInstrumentsInfo('spot')).rejects.toBeInstanceOf(BybitApiException);
  });

  it('times out cleanly', async () => {
    const fetchImpl = vi.fn(async () => new Promise<Response>(() => undefined));
    const client = new BybitHttpClient({ fetchImpl, timeoutMs: 5 });

    await expect(client.getInstrumentsInfo('spot')).rejects.toThrow(/timed out/);
  });

  it('throws on malformed responses', async () => {
    const fetchImpl = vi.fn(async () => createResponse('{"not":"json"}'));
    const client = new BybitHttpClient({ fetchImpl });

    await expect(client.getInstrumentsInfo('spot')).rejects.toThrow(/malformed response/);
  });
});
