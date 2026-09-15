import { describe, expect, it } from 'vitest';
import { Timeframe } from '../../../../common/enums.js';
import {
  BYBIT_PUBLIC_TIMEFRAME_TO_DOMAIN_TIMEFRAME,
  getBybitInterval,
  getBybitIntervalMs,
} from './bybit.constants.js';

describe('Bybit timeframe constants', () => {
  it('maps all supported public timeframes to domain timeframes', () => {
    expect(BYBIT_PUBLIC_TIMEFRAME_TO_DOMAIN_TIMEFRAME).toEqual({
      '1m': Timeframe.M1,
      '5m': Timeframe.M5,
      '15m': Timeframe.M15,
      '1h': Timeframe.H1,
      '4h': Timeframe.H4,
      '1d': Timeframe.D1,
    });
  });

  it('maps domain timeframes to Bybit intervals', () => {
    expect(getBybitInterval(Timeframe.M1)).toBe('1');
    expect(getBybitInterval(Timeframe.M5)).toBe('5');
    expect(getBybitInterval(Timeframe.M15)).toBe('15');
    expect(getBybitInterval(Timeframe.H1)).toBe('60');
    expect(getBybitInterval(Timeframe.H4)).toBe('240');
    expect(getBybitInterval(Timeframe.D1)).toBe('D');
  });

  it('maps domain timeframes to interval durations', () => {
    expect(getBybitIntervalMs(Timeframe.M1)).toBe(60_000);
    expect(getBybitIntervalMs(Timeframe.M5)).toBe(300_000);
    expect(getBybitIntervalMs(Timeframe.M15)).toBe(900_000);
    expect(getBybitIntervalMs(Timeframe.H1)).toBe(3_600_000);
    expect(getBybitIntervalMs(Timeframe.H4)).toBe(14_400_000);
    expect(getBybitIntervalMs(Timeframe.D1)).toBe(86_400_000);
  });

  it('returns undefined for unsupported timeframes', () => {
    expect(getBybitInterval('M30' as Timeframe)).toBeUndefined();
    expect(getBybitIntervalMs('M30' as Timeframe)).toBeUndefined();
  });
});
