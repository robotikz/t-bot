import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ScannerCandidate, ScannerService } from './scanner.service';

type ViewState = 'initial' | 'loading' | 'success' | 'empty' | 'error';

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './scanner.component.html',
  styleUrl: './scanner.component.scss',
})
export class ScannerComponent implements OnInit {
  private readonly scannerService = inject(ScannerService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  quoteCoins: string[] = [];

  readonly form = this.fb.nonNullable.group({
    quoteCoin: this.fb.nonNullable.control<(typeof this.quoteCoins)[number]>('USDC'),
    timeframe: this.fb.nonNullable.control<'1h' | '15m'>('1h'),
    secondaryTimeframe: this.fb.nonNullable.control<'1h' | '15m'>('15m'),
    limit: this.fb.nonNullable.control<number>(100, [Validators.min(1), Validators.max(100)]),
    minTurnover: this.fb.nonNullable.control<number | null>(10000),
  });

  state: ViewState = 'initial';
  isLoading = false;
  errorMessage = '';
  candidates: ScannerCandidate[] = [];
  selectedCandidate: ScannerCandidate | null = null;

  ngOnInit(): void {
    this.scannerService.getQuoteCoins().subscribe({
      next: (quoteCoins) => {
        const normalized = quoteCoins.length > 0 ? quoteCoins : ['USDC'];
        this.quoteCoins = normalized;

        const currentQuoteCoin = this.form.controls.quoteCoin.value;
        if (!normalized.includes(currentQuoteCoin)) {
          this.form.controls.quoteCoin.setValue(normalized[0]);
        }

        this.cdr.detectChanges();
      },
      error: () => {
        this.quoteCoins = ['USDC'];
        this.cdr.detectChanges();
      },
    });
  }

  selectQuoteCoin(quoteCoin: string): void {
    this.form.controls.quoteCoin.setValue(quoteCoin);
    this.cdr.detectChanges();
  }

  scan(): void {
    if (this.isLoading) {
      return;
    }

    this.state = 'loading';
    this.isLoading = true;
    this.errorMessage = '';
    this.selectedCandidate = null;
    this.candidates = [];

    const rawValue = this.form.getRawValue();
    const query = {
      quoteCoin: rawValue.quoteCoin,
      timeframe: rawValue.timeframe,
      secondaryTimeframe: rawValue.secondaryTimeframe,
      limit: rawValue.limit,
      ...(rawValue.minTurnover !== null ? { minTurnover: rawValue.minTurnover } : {}),
    };

    this.scannerService.scan(query).subscribe({
      next: (result) => {
        const candidates = Array.isArray(result?.candidates) ? [...result.candidates].sort((left, right) => right.score - left.score) : [];

        this.candidates = candidates;
        this.selectedCandidate = candidates[0] ?? null;
        this.state = candidates.length > 0 ? 'success' : 'empty';
        this.isLoading = false;

        this.cdr.detectChanges();
      },
      error: () => {
        this.candidates = [];
        this.selectedCandidate = null;
        this.state = 'error';
        this.errorMessage = 'Unable to load market data. Try again.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  selectCandidate(candidate: ScannerCandidate): void {
    this.selectedCandidate = candidate;
    this.cdr.detectChanges();
  }

  isSelected(candidate: ScannerCandidate): boolean {
    return this.selectedCandidate?.symbol === candidate.symbol;
  }

  private formatNumber(value: number | null | undefined, digits = 2): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'N/A';
    }

    return value.toFixed(digits);
  }

  get analysisText(): string {
    const candidate = this.selectedCandidate;
    if (!candidate) {
      return '';
    }

    const reasons = candidate.reasons.length > 0 ? candidate.reasons.map((reason) => `- ${reason}`).join('\n') : '- None';

    return [
      'Market Scanner Analysis',
      '======================',
      `Symbol: ${candidate.symbol}`,
      `Status: ${candidate.status}`,
      `Price: ${this.formatNumber(candidate.market.lastPrice, 4)}`,
      `24h Change: ${this.formatNumber(candidate.market.change24hPercent, 2)}%`,
      `24h Turnover: ${this.formatNumber(candidate.market.turnover24h, 0)}`,
      '',
      '1H',
      `Support: ${this.formatNumber(candidate.analysis1h?.support, 4)}`,
      `Resistance: ${this.formatNumber(candidate.analysis1h?.resistance, 4)}`,
      `Range: ${this.formatNumber(candidate.analysis1h?.rangePercent, 2)}%`,
      `Position: ${this.formatNumber(candidate.analysis1h?.positionInRangePercent, 0)}%`,
      `Volatility: ${this.formatNumber(candidate.analysis1h?.volatilityPercent, 2)}%`,
      `Trend: ${candidate.analysis1h?.trendDirection ?? 'N/A'}`,
      `Score: ${this.formatNumber(candidate.analysis1h?.gridScore, 2)}`,
      '',
      '15M',
      `Support: ${this.formatNumber(candidate.analysis15m?.support, 4)}`,
      `Resistance: ${this.formatNumber(candidate.analysis15m?.resistance, 4)}`,
      `Range: ${this.formatNumber(candidate.analysis15m?.rangePercent, 2)}%`,
      `Position: ${this.formatNumber(candidate.analysis15m?.positionInRangePercent, 0)}%`,
      `Volatility: ${this.formatNumber(candidate.analysis15m?.volatilityPercent, 2)}%`,
      `Trend: ${candidate.analysis15m?.trendDirection ?? 'N/A'}`,
      `Score: ${this.formatNumber(candidate.analysis15m?.gridScore, 2)}`,
      '',
      'Reasons:',
      reasons,
      '',
      `Overall Score: ${this.formatNumber(candidate.score, 2)}`,
    ].join('\n');
  }

  copyAnalysis(): void {
    if (!this.selectedCandidate) {
      return;
    }

    if (!navigator.clipboard) {
      return;
    }

    void navigator.clipboard.writeText(this.analysisText);
  }

  statusClass(status: ScannerCandidate['status']): string {
    if (status === 'CANDIDATE') {
      return 'status-candidate';
    }

    if (status === 'WATCH') {
      return 'status-watch';
    }

    return 'status-rejected';
  }
}
