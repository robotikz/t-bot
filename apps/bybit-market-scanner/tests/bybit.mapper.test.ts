import { describe, expect, it } from 'vitest';
import {
  mapBybitKline,
  mapBybitTicker,
  normalizeBybitKlines,
  timeframeToBybitInterval
} from '../src/modules/bybit/bybit.mapper.js';

describe('bybit.mapper', () => {
  it('maps intervals', () => {
    expect(timeframeToBybitInterval('15m')).toBe('15');
    expect(timeframeToBybitInterval('1h')).toBe('60');
  });

  it('omits optional bid/ask when not finite', () => {
    const mapped = mapBybitTicker(
      {
        symbol: 'BTCUSDC',
        lastPrice: '100',
        price24hPcnt: '0.01',
        highPrice24h: '102',
        lowPrice24h: '95',
        volume24h: '12',
        turnover24h: '1200',
        bid1Price: '',
        ask1Price: 'NaN'
      },
      123
    );

    expect(mapped).not.toHaveProperty('bidPrice');
    expect(mapped).not.toHaveProperty('askPrice');
    expect(mapped.change24hPercent).toBe(1);
  });

  it('maps finite bid/ask', () => {
    const mapped = mapBybitTicker(
      {
        symbol: 'ETHUSDC',
        lastPrice: '10',
        price24hPcnt: '-0.02',
        highPrice24h: '11',
        lowPrice24h: '9',
        volume24h: '100',
        turnover24h: '1000',
        bid1Price: '9.9',
        ask1Price: '10.1'
      },
      456
    );

    expect(mapped.bidPrice).toBe(9.9);
    expect(mapped.askPrice).toBe(10.1);
    expect(mapped.change24hPercent).toBe(-2);
  });

  it('maps and normalizes klines in chronological order', () => {
    const now = 3_000_000;

    const newestFirst = [
      ['1800000', '10', '12', '9', '11', '1', '10'],
      ['900000', '9', '10', '8', '9.5', '2', '20']
    ] as const;

    const normalized = normalizeBybitKlines(
      newestFirst.map((row) => [...row] as [string, string, string, string, string, string, string]),
      '15m',
      now
    );

    expect(normalized[0]?.timestamp).toBe(900000);
    expect(normalized[1]?.timestamp).toBe(1800000);

    const mapped = mapBybitKline(
      ['1800000', '10', '12', '9', '11', '1', '10'] as [
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ],
      '15m',
      now
    );
    expect(mapped.isClosed).toBe(true);
  });
});
