import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ScanResult, ScannerService } from './scanner.service';
import { ScannerComponent } from './scanner.component';

const scanResult: ScanResult = {
  timestamp: '2026-10-04T12:00:00.000Z',
  count: 2,
  candidates: [
    {
      symbol: 'ETHUSDT',
      score: 72.5,
      status: 'WATCH',
      market: {
        symbol: 'ETHUSDT',
        lastPrice: 3500,
        change24hPercent: 2.3,
        high24h: 3600,
        low24h: 3400,
        volume24h: 250000,
        turnover24h: 7000000,
        timestamp: 1,
      },
      analysis1h: {
        symbol: 'ETHUSDT',
        price: 3500,
        change24hPercent: 2.3,
        volume24h: 250000,
        turnover24h: 7000000,
        timeframe: '1h',
        rangeHigh: 3600,
        rangeLow: 3400,
        rangePercent: 4.5,
        distanceToSupportPercent: 2.1,
        distanceToResistancePercent: 1.8,
        volatilityPercent: 3.1,
        trendDirection: 'UP',
        trendStrength: 64,
        positionInRangePercent: 62,
        support: 3300,
        resistance: 3600,
        liquidityScore: 72,
        gridScore: 70,
        rejectionReasons: [],
      },
      analysis15m: {
        symbol: 'ETHUSDT',
        price: 3500,
        change24hPercent: 2.3,
        volume24h: 250000,
        turnover24h: 7000000,
        timeframe: '15m',
        rangeHigh: 3520,
        rangeLow: 3460,
        rangePercent: 1.4,
        distanceToSupportPercent: 1.2,
        distanceToResistancePercent: 1,
        volatilityPercent: 1.2,
        trendDirection: 'SIDEWAYS',
        trendStrength: 42,
        positionInRangePercent: 48,
        support: 3460,
        resistance: 3520,
        liquidityScore: 60,
        gridScore: 68,
        rejectionReasons: [],
      },
      reasons: ['MODERATE_SCORE'],
      rejectionReasons: ['LOW_RANGE'],
    },
    {
      symbol: 'BTCUSDT',
      score: 90.12,
      status: 'CANDIDATE',
      market: {
        symbol: 'BTCUSDT',
        lastPrice: 63500,
        change24hPercent: -1.2,
        high24h: 64000,
        low24h: 62000,
        volume24h: 500000,
        turnover24h: 12000000,
        timestamp: 1,
      },
      analysis1h: {
        symbol: 'BTCUSDT',
        price: 63500,
        change24hPercent: -1.2,
        volume24h: 500000,
        turnover24h: 12000000,
        timeframe: '1h',
        rangeHigh: 64500,
        rangeLow: 61000,
        rangePercent: 6.9,
        distanceToSupportPercent: 2.1,
        distanceToResistancePercent: 1.3,
        volatilityPercent: 4.8,
        trendDirection: 'UP',
        trendStrength: 78,
        positionInRangePercent: 57,
        support: 61000,
        resistance: 64500,
        liquidityScore: 88,
        gridScore: 91,
        rejectionReasons: [],
      },
      analysis15m: {
        symbol: 'BTCUSDT',
        price: 63500,
        change24hPercent: -1.2,
        volume24h: 500000,
        turnover24h: 12000000,
        timeframe: '15m',
        rangeHigh: 63800,
        rangeLow: 62800,
        rangePercent: 2.1,
        distanceToSupportPercent: 1,
        distanceToResistancePercent: 0.6,
        volatilityPercent: 1.9,
        trendDirection: 'UP',
        trendStrength: 69,
        positionInRangePercent: 55,
        support: 62800,
        resistance: 63800,
        liquidityScore: 85,
        gridScore: 89,
        rejectionReasons: [],
      },
      reasons: ['HIGH_SCORE', 'PASSES_FILTERS'],
      rejectionReasons: [],
    },
  ],
};

describe('ScannerComponent', () => {
  let fixture: ComponentFixture<ScannerComponent>;
  let component: ScannerComponent;
  let api: {
    scan: ReturnType<typeof vi.fn>;
    getQuoteCoins: ReturnType<typeof vi.fn>;
    getMarketsByQuoteCoin: ReturnType<typeof vi.fn>;
    getAnalysis: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    api = {
      scan: vi.fn(() => of(scanResult)),
      getQuoteCoins: vi.fn(() => of(['USDT', 'USDC'])),
      getMarketsByQuoteCoin: vi.fn(() =>
        of([
          { symbol: 'BTCUSDC', baseCoin: 'BTC', quoteCoin: 'USDC', status: 'Trading' },
          { symbol: 'ETHUSDC', baseCoin: 'ETH', quoteCoin: 'USDC', status: 'Trading' },
        ]),
      ),
      getAnalysis: vi.fn((symbol: string, timeframe: '1h' | '15m') =>
        of({
          symbol,
          price: symbol === 'BTCUSDC' ? 63480 : 3490,
          change24hPercent: 1.9,
          volume24h: 120000,
          turnover24h: symbol === 'BTCUSDC' ? 1800000 : 600000,
          timeframe,
          rangeHigh: symbol === 'BTCUSDC' ? 64500 : 3600,
          rangeLow: symbol === 'BTCUSDC' ? 62000 : 3400,
          rangePercent: timeframe === '1h' ? 3.9 : 1.8,
          support: symbol === 'BTCUSDC' ? 62500 : 3450,
          resistance: symbol === 'BTCUSDC' ? 64000 : 3550,
          distanceToSupportPercent: timeframe === '1h' ? 1.2 : 1.5,
          distanceToResistancePercent: timeframe === '1h' ? 1.4 : 1.2,
          positionInRangePercent: timeframe === '1h' ? 52 : 48,
          volatilityPercent: timeframe === '1h' ? 2.4 : 1.2,
          trendDirection: 'UP' as const,
          trendStrength: 54,
          liquidityScore: 85,
          gridScore: 86,
          rejectionReasons: [],
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [ScannerComponent],
      providers: [{ provide: ScannerService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(ScannerComponent);
    component = fixture.componentInstance;
  });

  const createUsdcAnalysis = (
    timeframe: '1h' | '15m',
    overrides: Partial<{
      price: number;
      turnover24h: number;
      rangeHigh: number;
      rangeLow: number;
      rangePercent: number;
      support: number;
      resistance: number;
      distanceToSupportPercent: number;
      distanceToResistancePercent: number;
      positionInRangePercent: number;
      volatilityPercent: number;
      trendDirection: 'UP' | 'DOWN' | 'SIDEWAYS';
    }> = {},
  ) => ({
    symbol: 'BTCUSDC',
    price: 5.252,
    change24hPercent: 1.4,
    volume24h: 420000,
    turnover24h: 1500000,
    timeframe,
    rangeHigh: timeframe === '1h' ? 5.45 : 5.31,
    rangeLow: timeframe === '1h' ? 4.832 : 4.978,
    rangePercent: timeframe === '1h' ? 6.6 : 2.7,
    support: timeframe === '1h' ? 4.832 : 4.978,
    resistance: timeframe === '1h' ? 5.45 : 5.31,
    distanceToSupportPercent: timeframe === '1h' ? 2.9 : 3.6,
    distanceToResistancePercent: timeframe === '1h' ? 3.1 : 1.2,
    positionInRangePercent: timeframe === '1h' ? 61 : 81,
    volatilityPercent: timeframe === '1h' ? 2.3 : 1.8,
    trendDirection: 'UP' as const,
    trendStrength: 58,
    liquidityScore: 84,
    gridScore: 82,
    rejectionReasons: [],
    ...overrides,
  });

  it('handles a successful response', async () => {
    fixture.detectChanges();

    component.scan();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.scan).toHaveBeenCalledTimes(1);
    expect(component.state).toBe('success');
    expect(component.candidates[0]?.symbol).toBe('BTCUSDT');
    expect(component.selectedCandidate?.symbol).toBe('BTCUSDT');
  });

  it('shows loading state while request is in flight', async () => {
    const pending$ = new Subject<ScanResult>();
    api.scan.mockReturnValueOnce(pending$);

    fixture.detectChanges();
    component.scan();
    fixture.detectChanges();

    expect(component.state).toBe('loading');
    expect(component.isLoading).toBe(true);

    pending$.next(scanResult);
    pending$.complete();
    await fixture.whenStable();
  });

  it('renders API error state', async () => {
    api.scan.mockReturnValueOnce(throwError(() => new Error('backend failed')));

    fixture.detectChanges();
    component.scan();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.state).toBe('error');
    expect(component.errorMessage).toContain('Unable to load market data.');
  });

  it('renders empty result state', async () => {
    api.scan.mockReturnValueOnce(
      of({
        timestamp: '2026-10-04T12:00:00.000Z',
        count: 0,
        candidates: [],
      }),
    );

    fixture.detectChanges();
    component.scan();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.state).toBe('empty');
    expect(component.selectedCandidate).toBeNull();
  });

  it('allows candidate selection', async () => {
    fixture.detectChanges();
    component.scan();
    await fixture.whenStable();
    fixture.detectChanges();

    component.selectCandidate(component.candidates[1]);

    expect(component.selectedCandidate?.symbol).toBe('ETHUSDT');
  });

  it('renders score and status in table', async () => {
    fixture.detectChanges();
    component.scan();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.candidates[0]?.score).toBe(90.12);
    expect(component.candidates[0]?.status).toBe('CANDIDATE');
  });

  it('renders rejection reasons in detail panel', async () => {
    fixture.detectChanges();
    component.scan();
    await fixture.whenStable();

    component.selectCandidate(component.candidates[1]);

    expect(component.selectedCandidate?.rejectionReasons).toContain('LOW_RANGE');
  });

  it('enforces pullback entry below current price when status is WAIT_PULLBACK', async () => {
    api.getAnalysis.mockImplementation((symbol: string, timeframe: '1h' | '15m') =>
      of(
        timeframe === '1h'
          ? createUsdcAnalysis('1h', {
              price: 5.252,
              support: 4.832,
              resistance: 5.45,
              distanceToResistancePercent: 3.2,
            })
          : createUsdcAnalysis('15m', {
              price: 5.252,
              support: 4.978,
              resistance: 5.31,
              positionInRangePercent: 81,
              trendDirection: 'SIDEWAYS',
              distanceToSupportPercent: 3.9,
              distanceToResistancePercent: 1.3,
            }),
      ),
    );

    fixture.detectChanges();
    component.scan();
    await fixture.whenStable();

    expect(component.usdcExecution?.status).toBe('WAIT_PULLBACK');
    expect(component.usdcExecution?.recommendation).toBeDefined();
    expect((component.usdcExecution?.recommendation?.entryHigh ?? Number.POSITIVE_INFINITY)).toBeLessThan(
      component.usdcExecution?.market?.currentPrice ?? 0,
    );
  });

  it('allows READY entry zone to include current price', async () => {
    api.getAnalysis.mockImplementation((symbol: string, timeframe: '1h' | '15m') =>
      of(
        timeframe === '1h'
          ? createUsdcAnalysis('1h', {
              price: 5.12,
              positionInRangePercent: 52,
              distanceToSupportPercent: 1.8,
              distanceToResistancePercent: 3.3,
            })
          : createUsdcAnalysis('15m', {
              price: 5.12,
              positionInRangePercent: 48,
              distanceToSupportPercent: 1.2,
              distanceToResistancePercent: 2.7,
              trendDirection: 'UP',
            }),
      ),
    );

    fixture.detectChanges();
    component.scan();
    await fixture.whenStable();

    const recommendation = component.usdcExecution?.recommendation;
    const currentPrice = component.usdcExecution?.market?.currentPrice ?? 0;

    expect(component.usdcExecution?.status).toBe('READY');
    expect(recommendation).toBeDefined();
    expect((recommendation?.entryLow ?? 0) <= currentPrice && (recommendation?.entryHigh ?? 0) >= currentPrice).toBe(true);
  });

  it('does not create an actionable entry zone for NO_ENTRY', async () => {
    api.getAnalysis.mockImplementation((symbol: string, timeframe: '1h' | '15m') =>
      of(
        timeframe === '1h'
          ? createUsdcAnalysis('1h', {
              turnover24h: 1500,
              distanceToSupportPercent: 2.2,
              distanceToResistancePercent: 2.5,
            })
          : createUsdcAnalysis('15m', {
              volatilityPercent: 0.1,
              positionInRangePercent: 50,
              distanceToSupportPercent: 2,
              distanceToResistancePercent: 2,
            }),
      ),
    );

    fixture.detectChanges();
    component.scan();
    await fixture.whenStable();

    expect(component.usdcExecution?.status).toBe('NO_ENTRY');
    expect(component.usdcExecution?.recommendation).toBeUndefined();
  });

  it('builds WAIT_BREAKOUT_RETEST entry around retest area, not around current price', async () => {
    api.getAnalysis.mockImplementation((symbol: string, timeframe: '1h' | '15m') =>
      of(
        timeframe === '1h'
          ? createUsdcAnalysis('1h', {
              price: 100,
              support: 92,
              resistance: 112,
              distanceToResistancePercent: 1,
              trendDirection: 'UP',
            })
          : createUsdcAnalysis('15m', {
              price: 100,
              support: 95,
              resistance: 110,
              positionInRangePercent: 78,
              distanceToResistancePercent: 0.7,
              trendDirection: 'UP',
            }),
      ),
    );

    fixture.detectChanges();
    component.scan();
    await fixture.whenStable();

    const recommendation = component.usdcExecution?.recommendation;
    const retestMid = ((recommendation?.entryLow ?? 0) + (recommendation?.entryHigh ?? 0)) / 2;

    expect(component.usdcExecution?.status).toBe('WAIT_BREAKOUT_RETEST');
    expect(recommendation).toBeDefined();
    expect(retestMid).toBeGreaterThan(104);
  });

  it('keeps WAIT_CONFIRMATION as WAIT while still showing a future entry zone', async () => {
    api.getAnalysis.mockImplementation((symbol: string, timeframe: '1h' | '15m') =>
      of(
        timeframe === '1h'
          ? createUsdcAnalysis('1h', {
              price: 5.3,
              distanceToSupportPercent: 1.7,
              distanceToResistancePercent: 2.9,
              trendDirection: 'UP',
            })
          : createUsdcAnalysis('15m', {
              price: 5.3,
              positionInRangePercent: 55,
              distanceToSupportPercent: 1.2,
              distanceToResistancePercent: 2.4,
              trendDirection: 'DOWN',
            }),
      ),
    );

    fixture.detectChanges();
    component.scan();
    await fixture.whenStable();

    expect(component.usdcExecution?.status).toBe('WAIT_CONFIRMATION');
    expect(component.usdcExecution?.decision).toBe('WAIT');
    expect(component.usdcExecution?.recommendation).toBeDefined();
  });
});
