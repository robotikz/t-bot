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
      symbol: 'ETHUSDC',
      score: 72.5,
      status: 'WATCH',
      market: {
        symbol: 'ETHUSDC',
        lastPrice: 3500,
        change24hPercent: 2.3,
        high24h: 3600,
        low24h: 3400,
        volume24h: 250000,
        turnover24h: 7000000,
        timestamp: 1,
      },
      analysis1h: {
        symbol: 'ETHUSDC',
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
        symbol: 'ETHUSDC',
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
      symbol: 'BTCUSDC',
      score: 90.12,
      status: 'CANDIDATE',
      market: {
        symbol: 'BTCUSDC',
        lastPrice: 63500,
        change24hPercent: -1.2,
        high24h: 64000,
        low24h: 62000,
        volume24h: 500000,
        turnover24h: 12000000,
        timestamp: 1,
      },
      analysis1h: {
        symbol: 'BTCUSDC',
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
        symbol: 'BTCUSDC',
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
  let api: { scan: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = {
      scan: vi.fn(() => of(scanResult)),
    };

    await TestBed.configureTestingModule({
      imports: [ScannerComponent],
      providers: [{ provide: ScannerService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(ScannerComponent);
    component = fixture.componentInstance;
  });

  it('handles a successful response', async () => {
    fixture.detectChanges();

    component.scan();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.scan).toHaveBeenCalledTimes(1);
    expect(component.state).toBe('success');
    expect(component.candidates[0]?.symbol).toBe('BTCUSDC');
    expect(component.selectedCandidate?.symbol).toBe('BTCUSDC');
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

    expect(component.selectedCandidate?.symbol).toBe('ETHUSDC');
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
});
