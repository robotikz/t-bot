import { Timeframe } from '../../../../common/enums.js';
import type { BybitPublicTimeframe } from '../../dto/list-bybit-candles.dto.js';

export const BYBIT_MARKET_CATEGORY = 'spot' as const;
export const BYBIT_MAINNET_BASE_URL = 'https://api.bybit.com';
export const BYBIT_TESTNET_BASE_URL = 'https://api-testnet.bybit.com';
export const BYBIT_DEFAULT_TIMEOUT_MS = 10_000;

export const BYBIT_PUBLIC_TIMEFRAME_TO_DOMAIN_TIMEFRAME: Record<BybitPublicTimeframe, Timeframe> = {
  '1m': Timeframe.M1,
  '5m': Timeframe.M5,
  '15m': Timeframe.M15,
  '1h': Timeframe.H1,
  '4h': Timeframe.H4,
  '1d': Timeframe.D1,
};

export const DOMAIN_TIMEFRAME_TO_BYBIT_INTERVAL: Record<Timeframe, string> = {
  [Timeframe.M1]: '1',
  [Timeframe.M5]: '5',
  [Timeframe.M15]: '15',
  [Timeframe.H1]: '60',
  [Timeframe.H4]: '240',
  [Timeframe.D1]: 'D',
};

export const DOMAIN_TIMEFRAME_TO_BYBIT_INTERVAL_MS: Record<Timeframe, number> = {
  [Timeframe.M1]: 60_000,
  [Timeframe.M5]: 300_000,
  [Timeframe.M15]: 900_000,
  [Timeframe.H1]: 3_600_000,
  [Timeframe.H4]: 14_400_000,
  [Timeframe.D1]: 86_400_000,
};

export function getBybitInterval(timeframe: Timeframe): string {
  return DOMAIN_TIMEFRAME_TO_BYBIT_INTERVAL[timeframe];
}

export function getBybitIntervalMs(timeframe: Timeframe): number {
  return DOMAIN_TIMEFRAME_TO_BYBIT_INTERVAL_MS[timeframe];
}
