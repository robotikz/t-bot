import { Account, Balance, Position } from '../../domain/types.js';
import {
  Trading212AccountSummaryResponse,
  Trading212PositionResponse,
} from './trading212-api.types.js';
import { Trading212MalformedResponseException } from './trading212.errors.js';

function parseNumber(value: unknown, field: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Trading212MalformedResponseException(`invalid ${field}`);
}

function requireString(value: unknown, field: string): string {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }

  throw new Trading212MalformedResponseException(`missing ${field}`);
}

export function mapTrading212BalancesFromAccountSummaryResponse(
  response: Trading212AccountSummaryResponse,
): Balance[] {
  if (!response || typeof response !== 'object') {
    throw new Trading212MalformedResponseException('missing account summary');
  }

  const currency = requireString(response.currency, 'currency');
  const availableToTrade = parseNumber(response.cash?.availableToTrade, 'cash.availableToTrade');
  const locked = parseNumber(response.cash?.reservedForOrders ?? 0, 'cash.reservedForOrders') + parseNumber(response.cash?.inPies ?? 0, 'cash.inPies');

  return [
    {
      asset: currency,
      free: availableToTrade,
      ...(locked > 0 ? { locked } : {}),
    },
  ];
}

export function mapTrading212AccountSummaryResponse(response: Trading212AccountSummaryResponse): Account {
  if (!response || typeof response !== 'object') {
    throw new Trading212MalformedResponseException('missing account summary');
  }

  const currency = requireString(response.currency, 'currency');
  const availableToTrade = parseNumber(response.cash?.availableToTrade, 'cash.availableToTrade');
  const locked = parseNumber(response.cash?.reservedForOrders ?? 0, 'cash.reservedForOrders') + parseNumber(response.cash?.inPies ?? 0, 'cash.inPies');
  const investedValue = response.investments?.currentValue;
  const realizedPnl = response.investments?.realizedProfitLoss;
  const unrealizedPnl = response.investments?.unrealizedProfitLoss;

  return {
    id: String(response.id),
    brokerId: 'trading212',
    currency,
    cash: availableToTrade + locked,
    investedValue: typeof investedValue === 'number' ? investedValue : undefined,
    totalValue: typeof response.totalValue === 'number' ? response.totalValue : undefined,
    realizedPnl: typeof realizedPnl === 'number' ? realizedPnl : undefined,
    unrealizedPnl: typeof unrealizedPnl === 'number' ? unrealizedPnl : undefined,
    balances: mapTrading212BalancesFromAccountSummaryResponse(response),
  };
}

export function mapTrading212PositionResponse(response: Trading212PositionResponse): Position {
  if (!response || typeof response !== 'object') {
    throw new Trading212MalformedResponseException('missing position');
  }

  const symbol = requireString(response.instrument?.ticker, 'instrument.ticker');
  const size = parseNumber(response.quantity, 'quantity');
  const averagePricePaid = response.averagePricePaid;
  const currentPrice = response.currentPrice;
  const currency = response.walletImpact?.currency ?? response.instrument?.currencyCode;
  const marketValue = response.walletImpact?.currentValue;
  const unrealizedPnl = response.walletImpact?.unrealizedProfitLoss;
  const availableQuantity = response.quantityAvailableForTrading;

  return {
    symbol,
    size,
    entryPrice: typeof averagePricePaid === 'number' ? averagePricePaid : undefined,
    currentPrice: typeof currentPrice === 'number' ? currentPrice : undefined,
    marketValue: typeof marketValue === 'number' ? marketValue : undefined,
    currency: typeof currency === 'string' ? currency : undefined,
    availableQuantity: typeof availableQuantity === 'number' ? availableQuantity : undefined,
    unrealizedPnl: typeof unrealizedPnl === 'number' ? unrealizedPnl : undefined,
  };
}

export function mapTrading212PositionsResponse(response: Trading212PositionResponse[]): Position[] {
  if (!Array.isArray(response)) {
    throw new Trading212MalformedResponseException('missing positions array');
  }

  return response.map((position) => mapTrading212PositionResponse(position));
}