import { describe, expect, it, vi } from 'vitest';
import { Trading212BrokerAdapter } from './trading212-broker.adapter.js';

function createResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('Trading212BrokerAdapter', () => {
  it('exposes the correct broker descriptor and lifecycle', async () => {
    const adapter = new Trading212BrokerAdapter();

    expect(adapter.id).toBe('trading212');
    expect(adapter.name).toBe('Trading212');
    expect(adapter.type).toBe('stock_broker');
    expect(adapter.capabilities).toEqual(['account']);
    expect(adapter.account).toBe(adapter);
    expect((adapter as unknown as { marketData?: unknown }).marketData).toBeUndefined();
    expect((adapter as unknown as { trading?: unknown }).trading).toBeUndefined();
    expect(adapter.isConnected()).toBe(false);

    await adapter.connect();
    expect(adapter.isConnected()).toBe(true);

    await adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
  });

  it('loads account summary and positions from the Trading212 client', async () => {
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(input.toString());
      expect(init?.headers).toMatchObject({
        Authorization: 'Basic dGVzdC1rZXk6dGVzdC1zZWNyZXQ=',
      });

      if (url.pathname.endsWith('/api/v0/equity/account/summary')) {
        return createResponse({
          id: 123456,
          currency: 'GBP',
          cash: {
            availableToTrade: 120.5,
            reservedForOrders: 10,
            inPies: 5,
          },
          investments: {
            currentValue: 1000,
            realizedProfitLoss: 12.34,
            totalCost: 900,
            unrealizedProfitLoss: 100,
          },
          totalValue: 1120.5,
        });
      }

      if (url.pathname.endsWith('/api/v0/equity/positions')) {
        return createResponse([
          {
            quantity: 2.5,
            averagePricePaid: 10.25,
            currentPrice: 11,
            instrument: {
              ticker: 'AAPL_US_EQ',
              currencyCode: 'USD',
              name: 'Apple Inc',
            },
            quantityAvailableForTrading: 2,
            walletImpact: {
              currency: 'USD',
              currentValue: 27.5,
              totalCost: 25.625,
              unrealizedProfitLoss: 1.875,
            },
          },
        ]);
      }

      throw new Error(`Unexpected URL ${url.toString()}`);
    });

    const adapter = new Trading212BrokerAdapter({
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const account = await adapter.getAccount();
    expect(account).toEqual({
      id: '123456',
      brokerId: 'trading212',
      currency: 'GBP',
      cash: 135.5,
      investedValue: 1000,
      totalValue: 1120.5,
      realizedPnl: 12.34,
      unrealizedPnl: 100,
      balances: [
        {
          asset: 'GBP',
          free: 120.5,
          locked: 15,
        },
      ],
    });

    const balances = await adapter.getBalances();
    expect(balances).toEqual([
      {
        asset: 'GBP',
        free: 120.5,
        locked: 15,
      },
    ]);

    const positions = await adapter.getPositions();
    expect(positions).toEqual([
      {
        symbol: 'AAPL_US_EQ',
        size: 2.5,
        entryPrice: 10.25,
        currentPrice: 11,
        marketValue: 27.5,
        currency: 'USD',
        availableQuantity: 2,
        unrealizedPnl: 1.875,
      },
    ]);
  });
});