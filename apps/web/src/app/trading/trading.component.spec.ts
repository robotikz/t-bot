import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TradingApiService } from './trading-api.service';
import { TradingComponent } from './trading.component';

describe('TradingComponent', () => {
  let fixture: ComponentFixture<TradingComponent>;
  let component: TradingComponent;
  const backtestResult = {
    config: {
      brokerId: 'bybit',
      symbol: 'BTCUSDT',
      timeframe: 'H1',
      strategyId: 'ema-crossover',
      startTime: '2026-01-01T00:00:00.000Z',
      endTime: '2026-01-02T00:00:00.000Z',
      initialCapital: 1000,
      feeRate: 0.001,
    },
    trades: [],
    equityCurve: [{ timestamp: new Date('2026-01-01T00:59:59.999Z'), equity: 1000 }],
    metrics: {
      initialCapital: 1000,
      finalCapital: 1000,
      netProfit: 0,
      netProfitPercent: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: null,
      grossProfit: 0,
      grossLoss: 0,
      averageTrade: null,
      averageWinningTrade: null,
      averageLosingTrade: null,
      maxDrawdown: 0,
    },
    signals: [
      {
        strategyId: 'ema-crossover',
        symbol: 'BTCUSDT',
        timeframe: 'H1',
        type: 'BUY' as const,
        timestamp: '2026-01-01T00:59:59.999Z',
        price: 100,
        reason: 'planned',
        indicators: { emaFast: 101, emaSlow: 99 },
      },
    ],
  };
  const apiService = {
    getBrokers: () => of([{ id: 'bybit', name: 'Bybit', type: 'crypto_exchange', capabilities: ['market_data'] }]),
    getStrategies: () => of([{ id: 'ema-crossover', name: 'EMA Crossover', description: 'Signals' }]),
    getMarkets: () => of([{ symbol: 'BTCUSDT' }]),
    getCandles: () =>
      of([
        {
          symbol: 'BTCUSDT',
          timeframe: 'H1',
          openTime: '2026-01-01T00:00:00.000Z',
          closeTime: '2026-01-01T00:59:59.999Z',
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume: 1,
          isClosed: true,
        },
      ]),
    runBacktest: () => of(backtestResult),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, ReactiveFormsModule, TradingComponent],
      providers: [{ provide: TradingApiService, useValue: apiService }],
    }).compileComponents();

    fixture = TestBed.createComponent(TradingComponent);
    component = fixture.componentInstance;
  });

  it('creates the page and validates the backtest form', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    component.form.controls.initialCapital.setValue(0);
    component.runBacktest();

    expect(component.errorMessage).toContain('Please fix the trading configuration');
  });

  it('renders API errors', () => {
    const failingService = {
      ...apiService,
      getBrokers: () => throwError(() => new Error('API error')),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CommonModule, ReactiveFormsModule, TradingComponent],
      providers: [{ provide: TradingApiService, useValue: failingService }],
    });

    const failingFixture = TestBed.createComponent(TradingComponent);
    failingFixture.detectChanges();

    expect(failingFixture.componentInstance.errorMessage).toContain('API error');
  });

  it('renders a successful no-trades backtest result', () => {
    fixture.detectChanges();
    component.candles = [
      {
        symbol: 'BTCUSDT',
        timeframe: 'H1',
        openTime: '2026-01-01T00:00:00.000Z',
        closeTime: '2026-01-01T00:59:59.999Z',
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1,
      },
    ];
    component.result = backtestResult as any;
    fixture.detectChanges();

    expect(component.result?.metrics.totalTrades).toBe(0);
    expect(component.metricCards).toHaveLength(8);
    expect(component.result?.trades).toEqual([]);
  });

  it('shows loading state while a backtest request is in flight', () => {
    const candles$ = new Subject<any[]>();
    const result$ = new Subject<any>();
    const loadingService = {
      ...apiService,
      getCandles: () => candles$,
      runBacktest: () => result$,
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CommonModule, ReactiveFormsModule, TradingComponent],
      providers: [{ provide: TradingApiService, useValue: loadingService }],
    });

    const loadingFixture = TestBed.createComponent(TradingComponent);
    const loadingComponent = loadingFixture.componentInstance;
    vi.spyOn(loadingComponent as any, 'renderCharts').mockImplementation(() => undefined);
    loadingFixture.detectChanges();

    loadingComponent.runBacktest();
    loadingFixture.detectChanges();
    expect(loadingComponent.isRunningBacktest).toBe(true);

    candles$.next([]);
    candles$.complete();
    result$.next(backtestResult);
    result$.complete();
  });

  it('maps candles and signal markers for chart rendering deterministically', () => {
    fixture.detectChanges();

    const candleData = (component as any).toCandleSeries([
      {
        symbol: 'BTCUSDT',
        timeframe: 'H1',
        openTime: '2026-01-01T00:00:00.000Z',
        closeTime: '2026-01-01T00:59:59.999Z',
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1,
      },
    ]);
    const markers = (component as any).toMarkers(backtestResult.signals);

    expect(candleData).toHaveLength(1);
    expect(markers).toEqual([
      expect.objectContaining({ text: 'BUY', position: 'belowBar' }),
    ]);
  });
});
