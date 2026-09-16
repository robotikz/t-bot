import { describe, expect, it } from 'vitest';
import {
  mapTrading212AccountSummaryResponse,
  mapTrading212BalancesFromAccountSummaryResponse,
  mapTrading212PositionsResponse,
} from './trading212.mapper.js';

describe('Trading212 mapper', () => {
  it('maps account summary to a generic account model', () => {
    const account = mapTrading212AccountSummaryResponse({
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
  });

  it('maps cash to a balance list', () => {
    expect(
      mapTrading212BalancesFromAccountSummaryResponse({
        id: 123456,
        currency: 'GBP',
        cash: {
          availableToTrade: 50,
          reservedForOrders: 5,
          inPies: 1,
        },
      }),
    ).toEqual([
      {
        asset: 'GBP',
        free: 50,
        locked: 6,
      },
    ]);
  });

  it('maps positions to the generic position model', () => {
    expect(
      mapTrading212PositionsResponse([
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
      ]),
    ).toEqual([
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