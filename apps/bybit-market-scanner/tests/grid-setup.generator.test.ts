import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/config.js';
import { GridSetupGenerator } from '../src/modules/signalizer/setup/grid-setup.generator.js';
import { calculateRisk } from '../src/modules/signalizer/setup/risk-calculator.js';
import type { Candle } from '../src/modules/market/market.types.js';
import type { MarketAnalysis } from '../src/modules/analysis/analysis.types.js';
import type { GridSetupInput } from '../src/modules/signalizer/setup/grid-setup.types.js';

function makeCandles(closes: number[]): Candle[] {
  const now = Date.now();
  return closes.map((close, index) => ({
    timestamp: now - (closes.length - index) * 15 * 60_000,
    open: close,
    high: close * 1.003,
    low: close * 0.997,
    close,
    volume: 1000,
    turnover: close * 1000,
    isClosed: true
  }));
}

function makeAnalysis(timeframe: '15m' | '1h' | '4h', overrides: Partial<MarketAnalysis> = {}): MarketAnalysis {
  return {
    symbol: 'NEARUSDT',
    price: 102,
    change24hPercent: -2,
    volume24h: 100000,
    turnover24h: 20_000_000,
    timeframe,
    rangeHigh: 110,
    rangeLow: 100,
    rangePercent: 10,
    support: 100,
    resistance: 110,
    distanceToSupportPercent: 2,
    distanceToResistancePercent: 7,
    positionInRangePercent: 40,
    volatilityPercent: 1.2,
    trendDirection: 'UP',
    trendStrength: 1.4,
    liquidityScore: 80,
    gridScore: 80,
    rejectionReasons: [],
    ...overrides
  };
}

function makeInput(overrides: Partial<GridSetupInput> = {}): GridSetupInput {
  const config = loadConfig();

  return {
    config,
    state: 'READY',
    market: {
      symbol: 'NEARUSDT',
      currentPrice: 102,
      turnover24h: 20_000_000
    },
    analysis4h: makeAnalysis('4h', { support: 99, resistance: 112, trendDirection: 'SIDEWAYS' }),
    analysis1h: makeAnalysis('1h'),
    analysis15m: makeAnalysis('15m', { trendDirection: 'SIDEWAYS', resistance: 109 }),
    candles15m: makeCandles([
      106, 105, 104, 103, 102, 101.5, 101.2, 101.1, 101, 100.9, 100.8, 100.9, 101, 101.1, 101.2,
      101.25, 101.3, 101.35
    ]),
    usdcAvailable: true,
    ...overrides
  };
}

describe('grid setup generator', () => {
  const generator = new GridSetupGenerator();

  it('valid sideways market -> READY (NEAR-like)', () => {
    const output = generator.evaluate(makeInput());

    expect(output.state).toBe('READY');
    expect(output.setup).toBeDefined();
    expect(output.setup?.gridLow).toBeLessThan(output.setup?.gridHigh ?? 0);
    expect(output.pairValidation.status).toBe('USDC_READY');
  });

  it('price too close to resistance -> not READY', () => {
    const output = generator.evaluate(
      makeInput({
        market: { symbol: 'NEARUSDT', currentPrice: 109.2, turnover24h: 20_000_000 },
        analysis1h: makeAnalysis('1h', {
          positionInRangePercent: 92,
          distanceToResistancePercent: 0.7
        })
      })
    );

    expect(output.state).toBe('SETUP_FORMING');
  });

  it('bearish 1H trend -> NO_TRADE (LINK/DOGE-like)', () => {
    const output = generator.evaluate(
      makeInput({
        analysis1h: makeAnalysis('1h', { trendDirection: 'DOWN', trendStrength: 2.6 })
      })
    );

    expect(output.state).toBe('NO_TRADE');
    expect(output.rejectionReasons).toContain('BEARISH_1H_TREND');
  });

  it('invalid/narrow Grid range -> NO_TRADE', () => {
    const output = generator.evaluate(
      makeInput({
        analysis1h: makeAnalysis('1h', {
          support: 100,
          resistance: 101.8,
          rangePercent: 1.8
        }),
        analysis4h: makeAnalysis('4h', { support: 99.8, resistance: 102 })
      })
    );

    expect(output.state).toBe('NO_TRADE');
    expect(output.rejectionReasons).toContain('RANGE_OUT_OF_BOUNDS');
  });

  it('15M support confirmation -> valid entry', () => {
    const output = generator.evaluate(makeInput());

    expect(output.market.timeframe15m.supportHeld).toBe(true);
    expect(output.market.timeframe15m.stabilizing).toBe(true);
    expect(output.setup?.entryLow).toBeGreaterThan(output.setup?.gridLow ?? 0);
  });

  it('15M still correcting -> SETUP_FORMING', () => {
    const output = generator.evaluate(
      makeInput({
        analysis15m: makeAnalysis('15m', { trendDirection: 'DOWN' }),
        candles15m: makeCandles([
          106, 105.5, 105, 104.5, 104, 103.5, 103, 102.5, 102, 101.5, 101, 100.5, 100, 99.8, 99.6,
          99.5, 99.4, 99.3
        ])
      })
    );

    expect(output.state).toBe('SETUP_FORMING');
  });

  it('USDC unavailable -> MANUAL_CHECK_REQUIRED', () => {
    const output = generator.evaluate(makeInput({ usdcAvailable: false }));

    expect(output.state).toBe('SETUP_FORMING');
    expect(output.pairValidation.status).toBe('MANUAL_CHECK_REQUIRED');
  });

  it('SL is below Grid range', () => {
    const output = generator.evaluate(makeInput());

    expect(output.setup?.stopLoss).toBeLessThan(output.setup?.gridLow ?? 0);
  });

  it('TP is near resistance and within grid high', () => {
    const output = generator.evaluate(makeInput());

    expect(output.setup?.takeProfit).toBeLessThanOrEqual(output.setup?.gridHigh ?? 0);
    expect((output.setup?.gridHigh ?? 0) - (output.setup?.takeProfit ?? 0)).toBeLessThanOrEqual(1);
  });

  it('grid count calculation follows configured thresholds', () => {
    const r4 = generator.evaluate(
      makeInput({
        analysis1h: makeAnalysis('1h', { support: 100, resistance: 104.5 }),
        analysis4h: makeAnalysis('4h', { support: 100.2, resistance: 104.6 })
      })
    );
    const r7 = generator.evaluate(
      makeInput({
        analysis1h: makeAnalysis('1h', { support: 100, resistance: 107.5 }),
        analysis4h: makeAnalysis('4h', { support: 100.2, resistance: 107.6 })
      })
    );
    const r15 = generator.evaluate(
      makeInput({
        analysis1h: makeAnalysis('1h', { support: 100, resistance: 115.5 }),
        analysis4h: makeAnalysis('4h', { support: 100.2, resistance: 115.6 })
      })
    );

    expect(r4.setup?.gridCount).toBe(6);
    expect(r7.setup?.gridCount).toBe(8);
    expect(r15.setup?.gridCount).toBe(10);
  });

  it('investment defaults to 300 on normal risk', () => {
    const output = generator.evaluate(makeInput());
    expect(output.setup?.investment).toBe(300);
  });

  it('confidence is objective and bounded', () => {
    const high = generator.evaluate(makeInput());
    const low = generator.evaluate(
      makeInput({
        usdcAvailable: false,
        market: { symbol: 'NEARUSDT', currentPrice: 108.5, turnover24h: 2_000_000 }
      })
    );

    expect((high.setup?.confidence ?? 0) > (low.setup?.confidence ?? 0)).toBe(true);
    expect(high.setup?.confidence).toBeLessThanOrEqual(100);
  });

  it('risk calculation categorizes objectively', () => {
    const lowRisk = calculateRisk({
      distanceToInvalidationPercent: 3.2,
      distanceToResistancePercent: 4,
      volatilityPercent: 1,
      rangePercent: 6,
      trendAligned: true,
      entryConfirmed: true,
      turnover24h: 20_000_000
    });

    const highRisk = calculateRisk({
      distanceToInvalidationPercent: 0.8,
      distanceToResistancePercent: 1,
      volatilityPercent: 5,
      rangePercent: 22,
      trendAligned: false,
      entryConfirmed: false,
      turnover24h: 1_500_000
    });

    expect(lowRisk.risk).toBe('LOW');
    expect(highRisk.risk).toBe('HIGH');
  });

  it('no invented levels when support/resistance unavailable', () => {
    const output = generator.evaluate(
      makeInput({
        analysis1h: makeAnalysis('1h', { support: 0, resistance: 0 })
      })
    );

    expect(output.state).toBe('NO_TRADE');
    expect(output.setup).toBeUndefined();
    expect(output.rejectionReasons).toContain('STRUCTURE_UNAVAILABLE');
  });

  it('high score but volatility out of bounds -> NO_TRADE (BTC-like)', () => {
    const output = generator.evaluate(
      makeInput({
        analysis1h: makeAnalysis('1h', { volatilityPercent: 6 })
      })
    );

    expect(output.state).toBe('NO_TRADE');
    expect(output.rejectionReasons).toContain('VOLATILITY_OUT_OF_BOUNDS');
  });
});
