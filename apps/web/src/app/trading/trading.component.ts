import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CandlestickSeries, ColorType, createChart, createSeriesMarkers, CandlestickData, LineSeries, UTCTimestamp } from 'lightweight-charts';
import { forkJoin, finalize } from 'rxjs';
import { TradingApiService, TradingBacktestResult, TradingBroker, TradingCandle, TradingMarket, TradingSignal, TradingStrategy } from './trading-api.service';

type ChartApi = ReturnType<typeof createChart>;

type UiCandle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

type UiLine = {
  time: UTCTimestamp;
  value: number;
};

type ChartMarker = {
  time: UTCTimestamp;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown';
  text: string;
};

@Component({
  selector: 'app-trading',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <section class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">Phase 9</p>
          <h1>Trading Platform</h1>
          <p class="subtitle">Run deterministic backtests on broker data, view signals, and inspect performance.</p>
        </div>

        <div class="status-pill" [class.loading]="isRunningBacktest || isLoadingReferenceData">
          <span *ngIf="isLoadingReferenceData">Loading configuration…</span>
          <span *ngIf="!isLoadingReferenceData && isRunningBacktest">Running backtest…</span>
          <span *ngIf="!isLoadingReferenceData && !isRunningBacktest">Ready</span>
        </div>
      </header>

      <mat-card class="panel">
        <form class="form-grid" [formGroup]="form" (ngSubmit)="runBacktest()">
          <mat-form-field appearance="outline">
            <mat-label>Broker</mat-label>
            <mat-select formControlName="broker" (selectionChange)="onBrokerChange()">
              <mat-option *ngFor="let broker of brokers" [value]="broker.id">{{ broker.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Symbol</mat-label>
            <input matInput formControlName="symbol" placeholder="BTCUSDT" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Timeframe</mat-label>
            <mat-select formControlName="timeframe">
              <mat-option *ngFor="let timeframe of timeframes" [value]="timeframe.value">{{ timeframe.label }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Strategy</mat-label>
            <mat-select formControlName="strategyId">
              <mat-option *ngFor="let strategy of strategies" [value]="strategy.id">{{ strategy.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>From</mat-label>
            <input matInput type="date" formControlName="startDate" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>To</mat-label>
            <input matInput type="date" formControlName="endDate" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Capital</mat-label>
            <input matInput type="number" min="1" step="1" formControlName="initialCapital" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fee</mat-label>
            <input matInput type="number" min="0" max="1" step="0.0001" formControlName="feeRate" />
          </mat-form-field>

          <div class="action-row">
            <button mat-raised-button color="primary" type="submit" [disabled]="isRunningBacktest || isLoadingReferenceData">
              Run Backtest
            </button>
            <p class="helper">{{ marketHint }}</p>
          </div>
        </form>

        <p *ngIf="errorMessage" class="error-message">{{ errorMessage }}</p>
        <p *ngIf="form.invalid && form.touched" class="error-message">Please fill in a valid trading configuration.</p>
      </mat-card>

      <mat-card class="panel chart-panel">
        <div class="panel-header">
          <div>
            <h2>Candlestick Chart</h2>
            <p>OHLC candles with BUY / SELL markers and EMA overlays when available.</p>
          </div>
        </div>

        <div class="chart-wrapper" #mainChartHost></div>
        <p class="attribution">
          Charts powered by
          <a href="https://www.tradingview.com" target="_blank" rel="noreferrer">TradingView Lightweight Charts™</a>
        </p>

        <div *ngIf="isRsiStrategy && rsiSeriesData.length" class="indicator-section">
          <h3>RSI</h3>
          <div class="chart-wrapper small" #indicatorChartHost></div>
        </div>
      </mat-card>

      <div class="stats-grid" *ngIf="result">
        <mat-card class="panel stat-card" *ngFor="let metric of metricCards">
          <p class="metric-label">{{ metric.label }}</p>
          <p class="metric-value">{{ metric.value }}</p>
        </mat-card>
      </div>

      <mat-card class="panel" *ngIf="result">
        <div class="panel-header">
          <div>
            <h2>Equity Curve</h2>
            <p>Chronological equity curve from the backtest result.</p>
          </div>
        </div>
        <div class="chart-wrapper equity" #equityChartHost></div>
      </mat-card>

      <mat-card class="panel" *ngIf="result">
        <div class="panel-header">
          <div>
            <h2>Trade History</h2>
            <p *ngIf="result.trades.length">Completed long trades generated by the backtest engine.</p>
            <p *ngIf="!result.trades.length">No trades generated for the selected configuration.</p>
          </div>
        </div>

        <div class="table-wrap" *ngIf="result.trades.length; else noTrades">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Entry Time</th>
                <th>Exit Time</th>
                <th>Entry Price</th>
                <th>Exit Price</th>
                <th>Quantity</th>
                <th>Gross P&amp;L</th>
                <th>Fees</th>
                <th>Net P&amp;L</th>
                <th>Return %</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let trade of result.trades; index as index">
                <td>{{ index + 1 }}</td>
                <td>{{ trade.entryTime | date: 'medium' }}</td>
                <td>{{ trade.exitTime | date: 'medium' }}</td>
                <td>{{ trade.entryPrice | number: '1.2-2' }}</td>
                <td>{{ trade.exitPrice | number: '1.2-2' }}</td>
                <td>{{ trade.quantity | number: '1.4-4' }}</td>
                <td [class.positive]="trade.grossPnl >= 0" [class.negative]="trade.grossPnl < 0">{{ trade.grossPnl | number: '1.2-2' }}</td>
                <td>{{ trade.fees | number: '1.2-2' }}</td>
                <td [class.positive]="trade.netPnl >= 0" [class.negative]="trade.netPnl < 0">{{ trade.netPnl | number: '1.2-2' }}</td>
                <td [class.positive]="trade.returnPercent >= 0" [class.negative]="trade.returnPercent < 0">{{ trade.returnPercent | number: '1.2-2' }}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ng-template #noTrades>
          <p class="empty-state">No trades generated.</p>
        </ng-template>
      </mat-card>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .page {
        display: grid;
        gap: 1.25rem;
      }

      .hero {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
      }

      .eyebrow {
        margin: 0 0 0.25rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.75rem;
        color: #6366f1;
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      .subtitle {
        margin-top: 0.4rem;
        color: #475569;
      }

      .status-pill {
        padding: 0.75rem 1rem;
        border-radius: 999px;
        background: #e0e7ff;
        color: #3730a3;
        font-weight: 600;
      }

      .status-pill.loading {
        background: #dbeafe;
        color: #1d4ed8;
      }

      .panel {
        border-radius: 20px;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1rem;
      }

      .action-row {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .helper {
        color: #64748b;
      }

      .error-message {
        margin-top: 1rem;
        color: #b91c1c;
        font-weight: 600;
      }

      .chart-panel,
      .equity-panel {
        overflow: hidden;
      }

      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1rem;
        gap: 1rem;
      }

      .panel-header p {
        margin-top: 0.25rem;
        color: #64748b;
      }

      .chart-wrapper {
        width: 100%;
        height: 440px;
        border-radius: 16px;
        overflow: hidden;
        background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(226, 232, 240, 0.92));
      }

      .chart-wrapper.small {
        height: 220px;
      }

      .chart-wrapper.equity {
        height: 300px;
      }

      .indicator-section {
        margin-top: 1rem;
      }

      .attribution {
        margin-top: 0.75rem;
        font-size: 0.85rem;
        color: #64748b;
      }

      .attribution a {
        color: #4f46e5;
      }

      .indicator-section h3 {
        margin-bottom: 0.5rem;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1rem;
      }

      .stat-card {
        padding: 1rem 1.2rem;
      }

      .metric-label {
        color: #64748b;
        font-size: 0.85rem;
      }

      .metric-value {
        margin-top: 0.45rem;
        font-size: 1.4rem;
        font-weight: 700;
      }

      .table-wrap {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        padding: 0.8rem 0.75rem;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
      }

      th {
        color: #475569;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .positive {
        color: #059669;
      }

      .negative {
        color: #dc2626;
      }

      .empty-state {
        color: #64748b;
      }

      @media (max-width: 1100px) {
        .form-grid,
        .stats-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .hero {
          align-items: flex-start;
          flex-direction: column;
        }
      }

      @media (max-width: 720px) {
        .form-grid,
        .stats-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class TradingComponent implements OnInit, AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(TradingApiService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('mainChartHost') private mainChartHost?: ElementRef<HTMLDivElement>;
  @ViewChild('equityChartHost') private equityChartHost?: ElementRef<HTMLDivElement>;
  @ViewChild('indicatorChartHost') private indicatorChartHost?: ElementRef<HTMLDivElement>;

  form = this.fb.nonNullable.group({
    broker: ['bybit', Validators.required],
    symbol: ['BTCUSDT', Validators.required],
    timeframe: ['1h', Validators.required],
    strategyId: ['ema-crossover', Validators.required],
    startDate: ['2026-01-01', Validators.required],
    endDate: ['2026-03-01', Validators.required],
    initialCapital: [1000, [Validators.required, Validators.min(1)]],
    feeRate: [0.001, [Validators.required, Validators.min(0), Validators.max(1)]],
  });

  brokers: TradingBroker[] = [];
  strategies: TradingStrategy[] = [];
  markets: TradingMarket[] = [];
  candles: TradingCandle[] = [];
  result: TradingBacktestResult | null = null;
  errorMessage = '';
  isLoadingReferenceData = false;
  isRunningBacktest = false;
  marketHint = 'Select a broker and symbol, then run a historical backtest.';
  timeframes = [
    { value: '1m', label: '1M' },
    { value: '5m', label: '5M' },
    { value: '15m', label: '15M' },
    { value: '1h', label: '1H' },
    { value: '4h', label: '4H' },
    { value: '1d', label: '1D' },
  ];

  private mainChart: ChartApi | null = null;
  private equityChart: ChartApi | null = null;
  private indicatorChart: ChartApi | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mainChartSeries: any = null;
  private emaFastSeries: any = null;
  private emaSlowSeries: any = null;
  private rsiSeries: any = null;
  private equitySeries: any = null;

  ngOnInit(): void {
    this.loadConfiguration();

    this.form.controls.broker.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((broker) => {
      if (broker) {
        this.loadMarkets(broker);
      }
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.renderCharts());
  }

  get isRsiStrategy(): boolean {
    return this.form.controls.strategyId.value === 'rsi';
  }

  get metricCards() {
    if (!this.result) {
      return [];
    }

    const metrics = this.result.metrics;
    return [
      { label: 'Initial Capital', value: this.formatCurrency(metrics.initialCapital) },
      { label: 'Final Capital', value: this.formatCurrency(metrics.finalCapital) },
      { label: 'Net Profit', value: this.formatSignedCurrency(metrics.netProfit) },
      { label: 'Return %', value: this.formatPercent(metrics.netProfitPercent) },
      { label: 'Total Trades', value: metrics.totalTrades.toString() },
      { label: 'Win Rate', value: this.formatNullablePercent(metrics.winRate) },
      { label: 'Average Trade', value: this.formatSignedCurrency(metrics.averageTrade) },
      { label: 'Max Drawdown', value: this.formatPercent(metrics.maxDrawdown * 100, false) },
    ];
  }

  get rsiSeriesData(): UiLine[] {
    if (!this.result) {
      return [];
    }

    return this.result.signals
      .map((signal) => ({
        time: this.toTimestamp(signal.timestamp),
        value: signal.indicators?.['rsi'],
      }))
      .filter((point): point is UiLine => typeof point.value === 'number');
  }

  onBrokerChange(): void {
    const broker = this.form.controls.broker.value;
    if (broker) {
      this.loadMarkets(broker);
    }
  }

  runBacktest(): void {
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = 'Please fix the trading configuration before running the backtest.';
      return;
    }

    const value = this.form.getRawValue();
    const startTime = this.toRangeStart(value.startDate);
    const endTime = this.toRangeEnd(value.endDate);

    this.isRunningBacktest = true;

    forkJoin({
      candles: this.api.getCandles({
        broker: value.broker,
        symbol: value.symbol,
        timeframe: value.timeframe,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }),
      result: this.api.runBacktest({
        broker: value.broker,
        symbol: value.symbol,
        timeframe: value.timeframe,
        strategyId: value.strategyId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        initialCapital: value.initialCapital,
        feeRate: value.feeRate,
      }),
    })
      .pipe(finalize(() => (this.isRunningBacktest = false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ candles, result }) => {
          this.candles = candles;
          this.result = result;
          this.marketHint = candles.length
            ? `${candles.length} candles loaded for ${value.symbol}`
            : 'No candles were returned for the selected range.';
          this.renderCharts();
        },
        error: (error: HttpErrorResponse | Error) => {
          this.result = null;
          this.candles = [];
          this.errorMessage = this.describeError(error);
          this.marketHint = 'Backtest request failed.';
          this.clearCharts();
        },
      });
  }

  private loadConfiguration(): void {
    this.isLoadingReferenceData = true;

    forkJoin({
      brokers: this.api.getBrokers(),
      strategies: this.api.getStrategies(),
    })
      .pipe(finalize(() => (this.isLoadingReferenceData = false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ brokers, strategies }) => {
          this.brokers = brokers;
          this.strategies = strategies;

          if (brokers.length) {
            this.form.controls.broker.setValue(brokers[0].id, { emitEvent: false });
            this.loadMarkets(brokers[0].id);
          }

          if (strategies.length) {
            this.form.controls.strategyId.setValue(strategies[0].id, { emitEvent: false });
          }
        },
        error: (error: HttpErrorResponse | Error) => {
          this.errorMessage = this.describeError(error);
        },
      });
  }

  private loadMarkets(broker: string): void {
    this.api.getMarkets(broker).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (markets) => {
        this.markets = markets;
        const firstMarket = markets[0]?.symbol;
        if (firstMarket && !this.form.controls.symbol.value) {
          this.form.controls.symbol.setValue(firstMarket);
        }

        this.marketHint = markets.length
          ? `${markets.length} symbols available for ${broker}`
          : 'No symbols returned for the selected broker.';
      },
      error: () => {
        this.markets = [];
      },
    });
  }

  private renderCharts(): void {
    if (!this.mainChartHost?.nativeElement || !this.result || !this.candles.length || !this.supportsChartRendering()) {
      this.clearCharts();
      return;
    }

    this.clearCharts();
    this.attachResizeObserver();

    this.mainChart = createChart(this.mainChartHost.nativeElement, {
      width: this.mainChartHost.nativeElement.clientWidth,
      height: 440,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#334155',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.2)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.2)' },
      },
      timeScale: { borderColor: '#cbd5e1' },
      rightPriceScale: { borderColor: '#cbd5e1' },
    });

    this.mainChartSeries = this.mainChart.addSeries(CandlestickSeries, {
      upColor: '#16a34a',
      downColor: '#dc2626',
      borderVisible: false,
      wickUpColor: '#16a34a',
      wickDownColor: '#dc2626',
    });

    const candleSeries = this.mainChartSeries as {
      setData: (data: CandlestickData[]) => void;
    };

    candleSeries.setData(this.toCandleSeries(this.candles));
    createSeriesMarkers(this.mainChartSeries, this.toMarkers(this.result.signals));

    const emaFastSeriesData = this.toIndicatorSeries(this.result.signals, 'emaFast');
    const emaSlowSeriesData = this.toIndicatorSeries(this.result.signals, 'emaSlow');

    if (emaFastSeriesData.length) {
      this.emaFastSeries = this.mainChart.addSeries(LineSeries, {
        color: '#6366f1',
        lineWidth: 2,
      });
      this.emaFastSeries.setData(emaFastSeriesData);
    }

    if (emaSlowSeriesData.length) {
      this.emaSlowSeries = this.mainChart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 2,
      });
      this.emaSlowSeries.setData(emaSlowSeriesData);
    }

    this.mainChart.timeScale().fitContent();

    if (this.isRsiStrategy && this.indicatorChartHost?.nativeElement && this.rsiSeriesData.length) {
      this.indicatorChart = createChart(this.indicatorChartHost.nativeElement, {
        width: this.indicatorChartHost.nativeElement.clientWidth,
        height: 220,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#334155',
        },
        grid: {
          vertLines: { color: 'rgba(148, 163, 184, 0.2)' },
          horzLines: { color: 'rgba(148, 163, 184, 0.2)' },
        },
        timeScale: { borderColor: '#cbd5e1' },
        rightPriceScale: { borderColor: '#cbd5e1' },
      });

      this.rsiSeries = this.indicatorChart.addSeries(LineSeries, {
        color: '#7c3aed',
        lineWidth: 2,
        priceLineVisible: false,
      });
      this.rsiSeries.setData(this.rsiSeriesData);
      this.indicatorChart.timeScale().fitContent();
    }

    if (this.equityChartHost?.nativeElement) {
      this.equityChart = createChart(this.equityChartHost.nativeElement, {
        width: this.equityChartHost.nativeElement.clientWidth,
        height: 300,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#334155',
        },
        grid: {
          vertLines: { color: 'rgba(148, 163, 184, 0.2)' },
          horzLines: { color: 'rgba(148, 163, 184, 0.2)' },
        },
        timeScale: { borderColor: '#cbd5e1' },
        rightPriceScale: { borderColor: '#cbd5e1' },
      });

      this.equitySeries = this.equityChart.addSeries(LineSeries, {
        color: '#0f766e',
        lineWidth: 2,
      });
      this.equitySeries.setData(this.result.equityCurve.map((point) => ({ time: this.toTimestamp(point.timestamp), value: point.equity })));
      this.equityChart.timeScale().fitContent();
    }
  }

  private clearCharts(): void {
    this.mainChart?.remove();
    this.equityChart?.remove();
    this.indicatorChart?.remove();
    this.mainChart = null;
    this.equityChart = null;
    this.indicatorChart = null;
    this.mainChartSeries = null;
    this.emaFastSeries = null;
    this.emaSlowSeries = null;
    this.rsiSeries = null;
    this.equitySeries = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private attachResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.mainChart?.applyOptions({ width: this.mainChartHost?.nativeElement.clientWidth ?? 0 });
      this.equityChart?.applyOptions({ width: this.equityChartHost?.nativeElement.clientWidth ?? 0 });
      this.indicatorChart?.applyOptions({ width: this.indicatorChartHost?.nativeElement.clientWidth ?? 0 });
    });

    if (this.mainChartHost?.nativeElement) {
      this.resizeObserver.observe(this.mainChartHost.nativeElement);
    }

    if (this.equityChartHost?.nativeElement) {
      this.resizeObserver.observe(this.equityChartHost.nativeElement);
    }

    if (this.indicatorChartHost?.nativeElement) {
      this.resizeObserver.observe(this.indicatorChartHost.nativeElement);
    }
  }

  private toCandleSeries(candles: TradingCandle[]): UiCandle[] {
    return candles.map((candle) => ({
      time: this.toTimestamp(candle.closeTime),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
  }

  private toMarkers(signals: TradingSignal[]): ChartMarker[] {
    return signals
      .filter((signal) => signal.type === 'BUY' || signal.type === 'SELL')
      .map((signal) => ({
        time: this.toTimestamp(signal.timestamp),
        position: signal.type === 'BUY' ? 'belowBar' : 'aboveBar',
        color: signal.type === 'BUY' ? '#16a34a' : '#dc2626',
        shape: signal.type === 'BUY' ? 'arrowUp' : 'arrowDown',
        text: signal.type,
      }));
  }

  private toIndicatorSeries(signals: TradingSignal[], key: 'emaFast' | 'emaSlow'): UiLine[] {
    return signals
      .map((signal) => ({
        time: this.toTimestamp(signal.timestamp),
        value: signal.indicators?.[key],
      }))
      .filter((point): point is UiLine => typeof point.value === 'number');
  }

  private toTimestamp(value: string | Date): UTCTimestamp {
    return Math.floor(new Date(value).getTime() / 1000) as UTCTimestamp;
  }

  private toRangeStart(dateValue: string): Date {
    return new Date(`${dateValue}T00:00:00.000Z`);
  }

  private toRangeEnd(dateValue: string): Date {
    return new Date(`${dateValue}T23:59:59.999Z`);
  }

  private formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  }

  private formatSignedCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }

    const sign = value > 0 ? '+' : '';
    return `${sign}${this.formatCurrency(value)}`;
  }

  private formatPercent(value: number, valueAlreadyPercent = true): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }

    const percentValue = valueAlreadyPercent ? value : value;
    const sign = percentValue > 0 ? '+' : '';
    return `${sign}${percentValue.toFixed(2)}%`;
  }

  private formatNullablePercent(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '—';
    }

    return this.formatPercent(value * 100);
  }

  private describeError(error: HttpErrorResponse | Error): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;
      if (typeof message === 'string') {
        return message;
      }

      if (Array.isArray(message) && message.length) {
        return message.join(', ');
      }

      return error.message || 'The API returned an error.';
    }

    return error.message || 'Unknown error';
  }

  private supportsChartRendering(): boolean {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && typeof HTMLCanvasElement !== 'undefined'
      && typeof ResizeObserver !== 'undefined';
  }
}
