import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { ScannerCandidate, ScannerService } from './scanner.service';
import type { CandlestickSeries, CandlestickData, CrosshairMode } from 'lightweight-charts';

export function formatAdaptiveMarketPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return 'N/A';
  }

  const abs = Math.abs(value);
  const fractionDigits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 4 : abs >= 0.0001 ? 6 : 8;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatAnalysisRange(low: number | null | undefined, high: number | null | undefined): string {
  if (low === null || low === undefined || high === null || high === undefined) {
    return 'N/A';
  }

  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0) {
    return 'N/A';
  }

  return `${formatAdaptiveMarketPrice(low)} - ${formatAdaptiveMarketPrice(high)}`;
}

function createAdaptivePriceFormat(): { type: 'custom'; formatter: (priceValue: number) => string } {
  return {
    type: 'custom',
    formatter: formatAdaptiveMarketPrice,
  };
}

@Component({
  selector: 'app-coin-analysis-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coin-analysis-modal.component.html',
  styleUrls: ['./coin-analysis-modal.component.scss'],
})
export class CoinAnalysisModalComponent implements OnChanges, AfterViewInit, OnDestroy {
  private readonly scannerService = inject(ScannerService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly formatMarketPrice = formatAdaptiveMarketPrice;

  @Input() candidate: ScannerCandidate | null = null;
  @Input() usdcExecution: any | null = null;
  @Input() analysisText: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() copy = new EventEmitter<string>();
  @Output() notify = new EventEmitter<{ message: string; type?: 'info' | 'error' }>();

  chart1h: any = null;
  chart15m: any = null;
  series1h: any = null;
  series15m: any = null;
  priceLines1h: any[] = [];
  priceLines15m: any[] = [];

  isChartsLoading = false;
  status1h: 'loading' | 'ready' | 'empty' | 'error' = 'loading';
  status15m: 'loading' | 'ready' | 'empty' | 'error' = 'loading';
  status1hMessage = 'Loading chart...';
  status15mMessage = 'Loading chart...';

  // symbol|timeframe keys for which a history load already succeeded this session
  private static readonly loadedHistory = new Set<string>();

  get analysis1h() {
    return this.candidate?.analysis1h ?? this.usdcExecution?.analysis1h ?? null;
  }

  get analysis15m() {
    return this.candidate?.analysis15m ?? this.usdcExecution?.analysis15m ?? null;
  }

  formatRangeFor(timeframe: '1h' | '15m'): string {
    const analysis = timeframe === '1h' ? this.analysis1h : this.analysis15m;
    return formatAnalysisRange(analysis?.rangeLow, analysis?.rangeHigh);
  }

  ngAfterViewInit(): void {
    void this.initOrUpdateCharts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['candidate'] && !changes['candidate'].firstChange) {
      void this.initOrUpdateCharts();
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  requestCopyAnalysis(): void {
    this.copy.emit(this.analysisText ?? '');
  }

  requestClose(): void {
    this.close.emit();
  }

  private async initOrUpdateCharts(): Promise<void> {
    const symbol = this.candidate?.symbol;
    if (!symbol) return;

    const host1 = document.getElementById('chart-1h');
    const host15 = document.getElementById('chart-15m');
    if (!host1 || !host15) return;

    this.destroyCharts();
    this.isChartsLoading = true;
    this.status1h = 'loading';
    this.status15m = 'loading';
    this.status1hMessage = 'Loading chart...';
    this.status15mMessage = 'Loading chart...';
    this.cdr.markForCheck();

    try {
      // dynamic import to avoid bundler interop problems with lightweight-charts ESM/CJS
      const lc: any = await import('lightweight-charts');
      console.debug('lightweight-charts module:', lc);
      const createChart = lc.createChart ?? lc.default?.createChart;
      const runtimeCrosshairMode = lc.CrosshairMode ?? lc.default?.CrosshairMode;
      const adaptivePriceFormat = createAdaptivePriceFormat();
      if (typeof createChart !== 'function') {
        console.error('lightweight-charts: createChart is not a function', lc);
        throw new Error('lightweight-charts import failed');
      }

      // create charts
      this.chart1h = createChart(host1, { layout: { background: { color: '#fff' }, textColor: '#333' }, crosshair: { mode: runtimeCrosshairMode?.Normal ?? 0 } });
      // Prefer v5 API: addSeries(CandlestickSeries, options)
      const runtimeCandlestickSeries = lc.CandlestickSeries ?? lc.default?.CandlestickSeries;
      if (runtimeCandlestickSeries) {
        this.series1h = this.chart1h.addSeries(runtimeCandlestickSeries, {
          upColor: '#16a34a',
          downColor: '#dc2626',
          borderVisible: false,
          priceFormat: adaptivePriceFormat,
        });
      } else if (typeof (this.chart1h as any).addCandlestickSeries === 'function') {
        // fallback for v4 API
        this.series1h = (this.chart1h as any).addCandlestickSeries();
        this.series1h?.applyOptions?.({ priceFormat: adaptivePriceFormat });
      } else {
        console.error('lightweight-charts: no candlestick series API available for 1h', { chart: this.chart1h, lc });
        throw new Error('lightweight-charts candlestick API missing');
      }

      this.chart15m = createChart(host15, { layout: { background: { color: '#fff' }, textColor: '#333' }, crosshair: { mode: runtimeCrosshairMode?.Normal ?? 0 } });
      if (runtimeCandlestickSeries) {
        this.series15m = this.chart15m.addSeries(runtimeCandlestickSeries, {
          upColor: '#16a34a',
          downColor: '#dc2626',
          borderVisible: false,
          priceFormat: adaptivePriceFormat,
        });
      } else if (typeof (this.chart15m as any).addCandlestickSeries === 'function') {
        this.series15m = (this.chart15m as any).addCandlestickSeries();
        this.series15m?.applyOptions?.({ priceFormat: adaptivePriceFormat });
      } else {
        console.error('lightweight-charts: no candlestick series API available for 15m', { chart: this.chart15m, lc });
        throw new Error('lightweight-charts candlestick API missing');
      }
    } catch (error) {
      // if chart lib missing, notify and bail
      console.error('Chart init error', error);
      this.notify.emit({ message: 'Chart initialization failed', type: 'error' });
      this.isChartsLoading = false;
      this.cdr.markForCheck();
      return;
    }

    // each timeframe is loaded independently; one failing does not affect the other
    const run1h = this.loadAndRender(symbol, '1h', 100, 3_600_000, 'series1h', (st, msg) => {
      this.status1h = st;
      this.status1hMessage = msg;
    }).then(() => {
      if (this.candidate?.symbol !== symbol) return;
      this.clearPriceLines();
      // draw support/resistance & grid range if present
      const s = this.candidate?.analysis1h?.support ?? this.usdcExecution?.analysis1h?.support;
      const r = this.candidate?.analysis1h?.resistance ?? this.usdcExecution?.analysis1h?.resistance;
      if (s !== undefined && r !== undefined) {
        this.addPriceLine(this.series1h, s, '#ff0000');
        this.addPriceLine(this.series1h, r, '#0070f3');
      }
    });
    const run15m = this.loadAndRender(symbol, '15m', 96, 900_000, 'series15m', (st, msg) => {
      this.status15m = st;
      this.status15mMessage = msg;
    });

    await Promise.allSettled([run1h, run15m]);
    this.isChartsLoading = false;
    this.cdr.markForCheck();
  }

  private async loadAndRender(
    symbol: string,
    timeframe: string,
    target: number,
    intervalMs: number,
    seriesKey: 'series1h' | 'series15m',
    setStatus: (st: 'loading' | 'ready' | 'empty' | 'error', msg: string) => void,
  ): Promise<void> {
    const series = this[seriesKey];
    const stale = () => this.candidate?.symbol !== symbol || this[seriesKey] !== series;
    try {
      let candles = this.validate(await this.fetchCandles(symbol, timeframe, target));
      const key = `${symbol}|${timeframe}`;
      const latest = candles.length ? (candles[candles.length - 1].time as number) * 1000 : 0;
      const fresh = Date.now() - latest <= intervalMs * 3;
      const sufficient = candles.length >= target && fresh;

      if (!sufficient && !CoinAnalysisModalComponent.loadedHistory.has(key)) {
        // GET /api/market-data/candles/load: fetches from the broker and upserts (idempotent)
        await this.loadHistory(symbol, timeframe, target);
        CoinAnalysisModalComponent.loadedHistory.add(key);
        candles = this.validate(await this.fetchCandles(symbol, timeframe, target));
      }

      if (stale() || !series) return;
      if (!candles.length) {
        setStatus('empty', `No ${timeframe.toUpperCase()} candle history available for ${symbol}.`);
      } else {
        series.setData(candles as any);
        (seriesKey === 'series1h' ? this.chart1h : this.chart15m)?.timeScale().fitContent();
        setStatus('ready', '');
      }
    } catch (error) {
      console.error(`Chart data error (${timeframe})`, error);
      if (stale()) return;
      setStatus('error', `Failed to load ${timeframe.toUpperCase()} candles.`);
    }
    this.cdr.markForCheck();
  }

  private validate(rows: any[]): CandlestickData[] {
    const byTime = new Map<number, CandlestickData>();
    for (const e of rows) {
      if (!e?.openTime) continue;
      const time = Math.floor(new Date(e.openTime).getTime() / 1000);
      const open = Number(e.open), high = Number(e.high), low = Number(e.low), close = Number(e.close);
      if (![time, open, high, low, close].every(Number.isFinite)) continue;
      byTime.set(time, { time: time as any, open, high, low, close });
    }
    return Array.from(byTime.values()).sort((a, b) => (a.time as number) - (b.time as number));
  }

  private async requestJson(path: string, symbol: string, timeframe: string, limit: number): Promise<any[]> {
    const q = new URLSearchParams({ broker: 'bybit', symbol, timeframe, limit: String(limit) });
    const res = await fetch(`${path}?${q.toString()}`);
    if (!res.ok) throw new Error(`${path} failed: HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    throw new Error(`${path} returned unexpected payload`);
  }

  private fetchCandles(symbol: string, timeframe: string, limit: number): Promise<any[]> {
    return this.requestJson('/api/market-data/candles', symbol, timeframe, limit);
  }

  private async loadHistory(symbol: string, timeframe: string, limit: number): Promise<void> {
    await this.requestJson('/api/market-data/candles/load', symbol, timeframe, limit);
  }

  private addPriceLine(series: any, price: number, color = '#ff0000'): void {
    if (!series || typeof series.createPriceLine !== 'function') return;
    try {
      const line = series.createPriceLine({ price, color, lineWidth: 1, lineStyle: 2 });
      if (series === this.series1h) this.priceLines1h.push(line);
      else this.priceLines15m.push(line);
    } catch {
      // ignore
    }
  }

  private clearPriceLines(): void {
    try {
      this.priceLines1h.forEach((l) => l && l.applyOptions && l.applyOptions({ visible: false }));
      this.priceLines15m.forEach((l) => l && l.applyOptions && l.applyOptions({ visible: false }));
    } catch {
      // ignore
    }
    this.priceLines1h = [];
    this.priceLines15m = [];
  }

  private destroyCharts(): void {
    try {
      if (this.chart1h) {
        this.chart1h.remove();
        this.chart1h = null;
      }
      if (this.chart15m) {
        this.chart15m.remove();
        this.chart15m = null;
      }
    } catch {
      // ignore
    }
    this.series1h = null;
    this.series15m = null;
    this.priceLines1h = [];
    this.priceLines15m = [];
  }

  async copyChartsAsImage(): Promise<void> {
    try {
      const host1 = document.getElementById('chart-1h');
      const host15 = document.getElementById('chart-15m');
      if (!host1 || !host15) {
        this.notify.emit({ message: 'Charts not available', type: 'error' });
        return;
      }

      const canvas1 = host1.querySelector('canvas');
      const canvas15 = host15.querySelector('canvas');
      if (!canvas1 || !canvas15) {
        this.notify.emit({ message: 'Chart canvases not found', type: 'error' });
        return;
      }

      const w = Math.max(canvas1.width, canvas15.width);
      const h = canvas1.height + canvas15.height;
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('no-canvas-ctx');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(canvas1, 0, 0);
      ctx.drawImage(canvas15, 0, canvas1.height);

      if (navigator.clipboard && (navigator.clipboard as any).write) {
        const blob = await new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), 'image/png'));
        if (!blob) throw new Error('blob-failed');
        // @ts-ignore
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        this.notify.emit({ message: 'Charts copied to clipboard', type: 'info' });
        return;
      }

      const url = out.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.candidate?.symbol ?? 'charts'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      this.notify.emit({ message: 'Chart downloaded as PNG', type: 'info' });
    } catch (error) {
      console.error('Copy/download charts error', error);
      this.notify.emit({ message: 'Failed to copy/download charts', type: 'error' });
    }
  }
}
