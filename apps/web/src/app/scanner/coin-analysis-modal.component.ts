import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { ScannerCandidate, ScannerService } from './scanner.service';
import type { CandlestickSeries, CandlestickData, CrosshairMode } from 'lightweight-charts';

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
    this.cdr.markForCheck();

    try {
      // dynamic import to avoid bundler interop problems with lightweight-charts ESM/CJS
      const lc: any = await import('lightweight-charts');
      console.debug('lightweight-charts module:', lc);
      const createChart = lc.createChart ?? lc.default?.createChart;
      const runtimeCrosshairMode = lc.CrosshairMode ?? lc.default?.CrosshairMode;
      if (typeof createChart !== 'function') {
        console.error('lightweight-charts: createChart is not a function', lc);
        throw new Error('lightweight-charts import failed');
      }

      // create charts
      this.chart1h = createChart(host1, { layout: { background: { color: '#fff' }, textColor: '#333' }, crosshair: { mode: runtimeCrosshairMode?.Normal ?? 0 } });
      if (!this.chart1h || typeof (this.chart1h as any).addCandlestickSeries !== 'function') {
        console.error('lightweight-charts: createChart returned unexpected object for 1h:', this.chart1h);
        throw new Error('lightweight-charts API missing: addCandlestickSeries');
      }
      this.series1h = this.chart1h.addCandlestickSeries();

      this.chart15m = createChart(host15, { layout: { background: { color: '#fff' }, textColor: '#333' }, crosshair: { mode: runtimeCrosshairMode?.Normal ?? 0 } });
      if (!this.chart15m || typeof (this.chart15m as any).addCandlestickSeries !== 'function') {
        console.error('lightweight-charts: createChart returned unexpected object for 15m:', this.chart15m);
        throw new Error('lightweight-charts API missing: addCandlestickSeries');
      }
      this.series15m = this.chart15m.addCandlestickSeries();
    } catch (error) {
      // if chart lib missing, notify and bail
      console.error('Chart init error', error);
      this.notify.emit({ message: 'Chart initialization failed', type: 'error' });
      this.isChartsLoading = false;
      this.cdr.markForCheck();
      return;
    }

    try {
      const [resp1, resp15] = await Promise.all([
        this.fetchCandles(symbol, '1h', 100),
        this.fetchCandles(symbol, '15m', 96),
      ]);

      const toPoint = (e: any) => {
        if (!e || !e.openTime) return null;
        return { time: Math.floor(new Date(e.openTime).getTime() / 1000), open: Number(e.open), high: Number(e.high), low: Number(e.low), close: Number(e.close) } as CandlestickData;
      };

      const series1 = (resp1 || []).map(toPoint).filter(Boolean);
      const series15 = (resp15 || []).map(toPoint).filter(Boolean);

      if (this.series1h && series1.length) this.series1h.setData(series1 as any);
      if (this.series15m && series15.length) this.series15m.setData(series15 as any);

      this.clearPriceLines();
      // draw support/resistance & grid range if present
      const s = this.candidate?.analysis1h?.support ?? this.usdcExecution?.analysis1h?.support;
      const r = this.candidate?.analysis1h?.resistance ?? this.usdcExecution?.analysis1h?.resistance;
      if (s !== undefined && r !== undefined) {
        this.addPriceLine(this.series1h, s, '#ff0000');
        this.addPriceLine(this.series1h, r, '#0070f3');
      }
    } catch (error) {
      console.error('Chart data load error', error);
      this.notify.emit({ message: 'Failed to load chart data', type: 'error' });
    }

    this.isChartsLoading = false;
    this.cdr.markForCheck();
  }

  private async fetchCandles(symbol: string, timeframe: string, limit = 100): Promise<any[]> {
    try {
      const q = new URLSearchParams({ broker: 'bybit', symbol, timeframe, limit: String(limit) });
      const res = await fetch(`/api/market-data/candles?${q.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.data)) return data.data;
      return [];
    } catch {
      return [];
    }
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
