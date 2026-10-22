import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, inject } from '@angular/core';
import { CoinAnalysisModalComponent } from './coin-analysis-modal.component';
import { ScannerHeaderHelpComponent } from './scanner-header-help.component';
import { ScannerInfoDialogComponent } from './scanner-info-dialog.component';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, map, of, Observable, shareReplay, switchMap, tap } from 'rxjs';
import { createExecutionMarketResolver, ExecutionMarketResolution, ExecutionMarketResolver } from './execution-market-resolver';
import { MarketAnalysis, MarketInstrument, ScannerCandidate, ScannerService } from './scanner.service';

type ViewState = 'initial' | 'loading' | 'success' | 'empty' | 'error';
type EntryTiming = 'READY' | 'WAIT_PULLBACK' | 'WAIT_BREAKOUT_RETEST' | 'WAIT_CONFIRMATION' | 'NO_ENTRY';
type ExecutionStatus = EntryTiming | 'UNAVAILABLE';
type ExecutionDecision = 'CAN_LAUNCH' | 'WAIT' | 'DO_NOT_LAUNCH' | 'UNAVAILABLE';
type GridRisk = 'LOW' | 'MEDIUM' | 'HIGH';
type ScannerTimeframe = '1h' | '15m';

interface ScannerFiltersStorage {
  quoteCoin: string;
  timeframe: ScannerTimeframe;
  secondaryTimeframe: ScannerTimeframe;
  limit: number;
  minTurnover: number | null;
}

interface ScannerSortingStorage {
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
}

const SCANNER_FILTERS_STORAGE_KEY = 'tbot.scanner.filters.v1';
const SCANNER_SORTING_STORAGE_KEY = 'tbot.scanner.sorting.v1';

function formatMarketPrice(value: number | null | undefined): string {
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

function hasValidAnalysisStructure(analysis: MarketAnalysis): boolean {
  return (
    Number.isFinite(analysis.price) &&
    analysis.price > 0 &&
    Number.isFinite(analysis.rangeHigh) &&
    analysis.rangeHigh > 0 &&
    Number.isFinite(analysis.rangeLow) &&
    analysis.rangeLow > 0 &&
    analysis.rangeHigh >= analysis.rangeLow &&
    Number.isFinite(analysis.rangePercent) &&
    analysis.rangePercent >= 0 &&
    Number.isFinite(analysis.positionInRangePercent) &&
    analysis.positionInRangePercent >= 0 &&
    analysis.positionInRangePercent <= 100 &&
    Number.isFinite(analysis.support) &&
    analysis.support > 0 &&
    Number.isFinite(analysis.resistance) &&
    analysis.resistance > 0 &&
    analysis.resistance > analysis.support &&
    Number.isFinite(analysis.distanceToSupportPercent) &&
    analysis.distanceToSupportPercent >= 0 &&
    Number.isFinite(analysis.distanceToResistancePercent) &&
    analysis.distanceToResistancePercent >= 0
  );
}

interface ExecutionChecks {
  usdcPairAvailable: boolean;
  suitableForSpotGrid: boolean;
  liquiditySufficient: boolean;
  closeToSupport: boolean;
  tooCloseToResistance: boolean;
  trend1hAcceptable: boolean;
  trend15mAcceptable: boolean;
  volatilitySufficient: boolean;
  insideReasonableRange: boolean;
  supportResistanceValid: boolean;
}

interface ExecutionCheckView {
  key: keyof ExecutionChecks;
  label: string;
  passed: boolean;
  important: boolean;
}

interface GridSetupRecommendation {
  investmentUsdc: number;
  entryLow: number;
  entryHigh: number;
  gridLow: number;
  gridHigh: number;
  gridCount: number;
  stopLoss: number;
  takeProfit: number;
  trailingUp: boolean;
  trailingStopPercent: number;
  risk: GridRisk;
  executionDecision: ExecutionDecision;
}

interface UsdcExecutionSection {
  analysisSymbol: string;
  analysisQuote: string;
  baseAsset: string;
  executionSymbol: string;
  executionMarket: string;
  executionQuote: string;
  available: boolean;
  isLoading: boolean;
  errorMessage: string;
  reason: string;
  liquidityDecision: 'PASS' | 'FAIL' | 'N/A';
  executionStatus: 'AVAILABLE' | 'UNAVAILABLE';
  marketSuitableForGrid: boolean;
  marketSuitabilityReason: string;
  analysisStatus: ScannerCandidate['status'];
  analysisEntryTiming: EntryTiming;
  analysisDecision: ExecutionDecision;
  executionEligibilityDecision: ExecutionDecision;
  decisionContext: string;
  entryTiming: EntryTiming;
  entryScore: number;
  status: ExecutionStatus;
  decision: ExecutionDecision;
  market?: {
    currentPrice: number;
    change24hPercent: number;
    turnover24h: number;
  };
  analysis1h?: MarketAnalysis;
  analysis15m?: MarketAnalysis;
  checks: ExecutionChecks;
  failedOrImportantChecks: ExecutionCheckView[];
  allChecks: ExecutionCheckView[];
  recommendation?: GridSetupRecommendation;
}

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CoinAnalysisModalComponent,
    ScannerHeaderHelpComponent,
    ScannerInfoDialogComponent,
  ],
  templateUrl: './scanner.component.html',
  styleUrl: './scanner.component.scss',
})
export class ScannerComponent {
  private readonly scannerService = inject(ScannerService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private usdcExecutionRequestId = 0;
  readonly formatMarketPrice = formatMarketPrice;

  quoteCoins: string[] = ['USDC'];
  isFiltersExpanded = false;

  readonly form = this.fb.nonNullable.group({
    quoteCoin: this.fb.nonNullable.control<string>('USDC'),
    timeframe: this.fb.nonNullable.control<'1h' | '15m'>('1h'),
    secondaryTimeframe: this.fb.nonNullable.control<'1h' | '15m'>('15m'),
    limit: this.fb.nonNullable.control<number>(100, [Validators.min(1), Validators.max(500)]),
    minTurnover: this.fb.nonNullable.control<number | null>(25000),
  });

  state: ViewState = 'initial';
  isLoading = false;
  errorMessage = '';
  candidates: ScannerCandidate[] = [];
  // keep original scanned order for stable sorting reset
  private scannedCandidates: ScannerCandidate[] = [];
  selectedCandidate: ScannerCandidate | null = null;
  usdcExecution: UsdcExecutionSection | null = null;
  private spotInstruments: MarketInstrument[] | null = null;
  private spotInstrumentsRequest$: Observable<MarketInstrument[]> | null = null;
  private executionMarketResolver: ExecutionMarketResolver | null = null;
  // table sorting state
  sortColumn: string | null = 'score';
  sortDirection: 'asc' | 'desc' | null = 'desc';
  // modal state
  isAnalysisModalOpen = false;
  // simple toast messages
  toasts: { id: number; message: string; type?: 'info' | 'error' }[] = [];
  private toastSeq = 0;
  // expandable sections per symbol
  expandedSections: Record<string, Record<string, boolean>> = {};
  // table UX
  isScannerInfoOpen = false;
  readonly columnHelp: Record<string, string> = {
    index: 'Row number in the current table order.',
    status:
      'CANDIDATE: no rejection reasons. WATCH: soft rejection reasons with score ≥ 60. REJECTED: hard rejection reason or score < 60 with rejections.',
    symbol: 'Trading pair analyzed by the scanner, for example SUIUSDC.',
    price: 'Latest market price from the ticker feed.',
    entry:
      'Current entry recommendation from scanner logic: READY, WAIT_PULLBACK, WAIT_BREAKOUT_RETEST, WAIT_CONFIRMATION, or NO_ENTRY.',
    score:
      'Overall market suitability score from scanner analysis (primary/secondary timeframe weighted score). Not a profit probability.',
    entryScore:
      'Entry timing score from scanner entry logic (0–100). Higher means conditions are more favorable now.',
    turnover24h:
      '24h trading turnover from ticker data (quote-currency value, e.g. USDC on USDC scans).',
    change24hPercent: 'Percentage price change over the last 24 hours.',
    trend1h: 'Detected trend on the 1-hour timeframe: UP, DOWN, or SIDEWAYS.',
    trend15m: 'Detected trend on the 15-minute timeframe: UP, DOWN, or SIDEWAYS.',
    position:
      'Price position in the calculated range: ((price - rangeLow) / (rangeHigh - rangeLow)) × 100, clamped to 0–100%.',
    range1h: '1H range size in percent: ((rangeHigh - rangeLow) / rangeLow) × 100.',
  };

  constructor() {
    this.restoreFiltersFromStorage();
    this.restoreSortingFromStorage();

    this.form.valueChanges.subscribe(() => {
      this.saveFiltersToStorage();
    });

    this.scannerService.getQuoteCoins().pipe(
      map((quoteCoins) => (quoteCoins.length > 0 ? quoteCoins : ['USDC'])),
      catchError((error) => {
        return of(['USDC']);
      }),
    ).subscribe((quoteCoins) => {
      this.quoteCoins = quoteCoins;

      if (!quoteCoins.includes(this.form.controls.quoteCoin.value)) {
        this.form.controls.quoteCoin.setValue(quoteCoins[0] ?? 'USDC');
      }

      this.saveFiltersToStorage();

      this.cdr.markForCheck();
    });
  }

  selectQuoteCoin(quoteCoin: string): void {
    this.form.controls.quoteCoin.setValue(quoteCoin);
    this.cdr.markForCheck();
  }

  toggleFilters(): void {
    this.isFiltersExpanded = !this.isFiltersExpanded;
    this.cdr.markForCheck();
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
        const candidates = Array.isArray(result?.candidates) ? [...result.candidates] : [];

        // preserve original scanned order and apply initial default sort (score desc)
        this.scannedCandidates = candidates.slice();
        this.applySort();

        this.selectedCandidate = this.candidates[0] ?? null;
        if (this.selectedCandidate) {
          this.loadUsdcExecution(this.selectedCandidate);
        } else {
          this.usdcExecution = null;
        }
        this.state = candidates.length > 0 ? 'success' : 'empty';
        this.isLoading = false;

        this.cdr.markForCheck();
      },
      error: () => {
        this.candidates = [];
        this.selectedCandidate = null;
        this.state = 'error';
        this.errorMessage = 'Unable to load market data. Try again.';
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  selectCandidate(candidate: ScannerCandidate): void {
    this.selectedCandidate = candidate;
    // ensure expanded sections default for this symbol
    const sym = candidate?.symbol ?? '__none__';
    if (!this.expandedSections[sym]) {
      this.expandedSections[sym] = {
        marketSummary: true,
        h1: true,
        m15: true,
        execution: true,
      };
    }
    this.loadUsdcExecution(candidate);
    this.cdr.markForCheck();
  }

  onRowClick(candidate: ScannerCandidate, event: MouseEvent): void {
    // prevent opening modal when clicking on buttons/links inside row
    const target = event.target as HTMLElement | null;
    if (target) {
      const actionable = target.closest('button, a, [data-no-modal]');
      if (actionable) {
        return;
      }
    }

    this.selectCandidate(candidate);
    this.openAnalysisModal();
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

    const usdcExecutionText = this.usdcExecution
      ? [
          '',
          'ANALYSIS',
          '========',
          `Analysis Symbol: ${this.usdcExecution.analysisSymbol}`,
          `Analysis Quote: ${this.usdcExecution.analysisQuote}`,
          '',
          'EXECUTION / GRID BOT',
          '====================',
          `Base Asset: ${this.usdcExecution.baseAsset}`,
          `Execution Symbol: ${this.usdcExecution.executionSymbol || 'N/A'}`,
          `Execution Quote: ${this.usdcExecution.executionQuote}`,
          `USDC Pair Available: ${this.usdcExecution.available ? 'YES' : 'NO'}`,
          `Execution Status: ${this.usdcExecution.executionStatus}`,
          `Entry Timing: ${this.usdcExecution.entryTiming}`,
          `Analysis Decision: ${this.usdcExecution.analysisDecision}`,
          `Execution Eligibility Decision: ${this.usdcExecution.executionEligibilityDecision}`,
          `Authoritative Decision: ${this.usdcExecution.decision}`,
          `USDC Turnover: ${this.formatNumber(this.usdcExecution.market?.turnover24h, 0)}`,
          `Liquidity Decision: ${this.usdcExecution.liquidityDecision}`,
          `Reason: ${this.usdcExecution.reason}`,
        ]
      : [];

    return [
      'Market Scanner Analysis',
      '======================',
      `Symbol: ${candidate.symbol}`,
      `Status: ${candidate.status}`,
      `Price: ${this.formatMarketPrice(candidate.market.lastPrice)}`,
      `24h Change: ${this.formatNumber(candidate.market.change24hPercent, 2)}%`,
      `24h Turnover: ${this.formatNumber(candidate.market.turnover24h, 0)}`,
      '',
      '1H',
      `Support: ${this.formatMarketPrice(candidate.analysis1h?.support)}`,
      `Resistance: ${this.formatMarketPrice(candidate.analysis1h?.resistance)}`,
      `Range: ${this.formatNumber(candidate.analysis1h?.rangePercent, 2)}%`,
      `Position: ${this.formatNumber(candidate.analysis1h?.positionInRangePercent, 0)}%`,
      `Volatility: ${this.formatNumber(candidate.analysis1h?.volatilityPercent, 2)}%`,
      `Trend: ${candidate.analysis1h?.trendDirection ?? 'N/A'}`,
      `Score: ${this.formatNumber(candidate.analysis1h?.gridScore, 2)}`,
      '',
      '15M',
      `Support: ${this.formatMarketPrice(candidate.analysis15m?.support)}`,
      `Resistance: ${this.formatMarketPrice(candidate.analysis15m?.resistance)}`,
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
      ...usdcExecutionText,
    ].join('\n');
  }

  copyAnalysis(): void {
    if (!this.selectedCandidate) {
      return;
    }

    if (!navigator.clipboard) {
      this.showToast('Clipboard not available', 'error');
      return;
    }

    void navigator.clipboard.writeText(this.analysisText).then(
      () => this.showToast('Copied to clipboard', 'info'),
      () => this.showToast('Failed to copy to clipboard', 'error'),
    );
  }

  showToast(message: string, type: 'info' | 'error' = 'info', timeout = 2000): void {
    const id = ++this.toastSeq;
    this.toasts.push({ id, message, type });
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
      this.cdr.markForCheck();
    }, timeout);
    this.cdr.markForCheck();
  }

  openAnalysisModal(): void {
    this.isAnalysisModalOpen = true;
    // ensure sections expanded default for this symbol
    const sym = this.selectedCandidate?.symbol ?? '__none__';
    if (!this.expandedSections[sym]) {
      this.expandedSections[sym] = {
        marketSummary: true,
        h1: true,
        m15: true,
        execution: true,
      };
    }
    this.cdr.markForCheck();
    // focus modal for accessibility
    setTimeout(() => {
      const el = document.querySelector('.analysis-modal') as HTMLElement | null;
      el?.focus();
    }, 0);
  }

  closeAnalysisModal(): void {
    this.isAnalysisModalOpen = false;
    this.cdr.markForCheck();
  }

  copyFromModal(text: string): void {
    if (!text) return;
    if (!navigator.clipboard) {
      this.showToast('Clipboard not available', 'error');
      return;
    }

    void navigator.clipboard.writeText(text).then(
      () => this.showToast('Copied to clipboard', 'info'),
      () => this.showToast('Failed to copy to clipboard', 'error'),
    );
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isAnalysisModalOpen) {
      this.closeAnalysisModal();
      return;
    }

    if (event.key === 'Escape' && this.isScannerInfoOpen) {
      this.closeScannerInfo();
      return;
    }

  }

  toggleScannerInfo(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.isScannerInfoOpen = !this.isScannerInfoOpen;
    this.cdr.markForCheck();
  }

  closeScannerInfo(): void {
    this.isScannerInfoOpen = false;
    this.cdr.markForCheck();
  }

  toggleSection(symbol: string, section: string): void {
    const s = this.expandedSections[symbol] ?? {};
    s[section] = !s[section];
    this.expandedSections[symbol] = s;
    this.cdr.markForCheck();
  }

  isSectionExpanded(symbol: string, section: string): boolean {
    const s = this.expandedSections[symbol];
    if (!s) return true; // default expanded
    return !!s[section];
  }

  // Sorting
  applySort(): void {
    const col = this.sortColumn;
    const dir = this.sortDirection;
    const source = this.scannedCandidates.slice();
    if (!col || !dir) {
      this.candidates = source;
      return;
    }

    const withIndex = source.map((v, i) => ({ v, i }));

    withIndex.sort((a, b) => {
      const left = a.v as any;
      const right = b.v as any;
      let av: any = null;
      let bv: any = null;

      switch (col) {
        case 'symbol':
          av = (left.symbol ?? '') as string;
          bv = (right.symbol ?? '') as string;
          break;
        case 'price':
          av = left.market?.lastPrice ?? Number.NEGATIVE_INFINITY;
          bv = right.market?.lastPrice ?? Number.NEGATIVE_INFINITY;
          break;
        case 'change24hPercent':
          av = left.market?.change24hPercent ?? Number.NEGATIVE_INFINITY;
          bv = right.market?.change24hPercent ?? Number.NEGATIVE_INFINITY;
          break;
        case 'turnover24h':
          av = left.market?.turnover24h ?? Number.NEGATIVE_INFINITY;
          bv = right.market?.turnover24h ?? Number.NEGATIVE_INFINITY;
          break;
        case 'range1h':
          av = left.analysis1h?.rangePercent ?? Number.NEGATIVE_INFINITY;
          bv = right.analysis1h?.rangePercent ?? Number.NEGATIVE_INFINITY;
          break;
        case 'position':
          av = left.analysis1h?.positionInRangePercent ?? Number.NEGATIVE_INFINITY;
          bv = right.analysis1h?.positionInRangePercent ?? Number.NEGATIVE_INFINITY;
          break;
        case 'status':
          av = (left.status ?? '') as string;
          bv = (right.status ?? '') as string;
          break;
        case 'entry':
          av = (this.candidateEntryTiming(left) ?? '') as string;
          bv = (this.candidateEntryTiming(right) ?? '') as string;
          break;
        case 'score':
          av = left.score ?? Number.NEGATIVE_INFINITY;
          bv = right.score ?? Number.NEGATIVE_INFINITY;
          break;
        case 'entryScore':
          av = this.candidateEntryScore(left) ?? Number.NEGATIVE_INFINITY;
          bv = this.candidateEntryScore(right) ?? Number.NEGATIVE_INFINITY;
          break;
        default:
          av = left[col] ?? '';
          bv = right[col] ?? '';
      }

      // handle nulls
      const na = av === null || av === undefined || Number.isNaN(av);
      const nb = bv === null || bv === undefined || Number.isNaN(bv);
      if (na && nb) return a.i - b.i; // stable
      if (na) return 1;
      if (nb) return -1;

      if (typeof av === 'string' && typeof bv === 'string') {
        const cmp = av.localeCompare(bv);
        return dir === 'asc' ? cmp || a.i - b.i : -cmp || a.i - b.i;
      }

      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return a.i - b.i;
    });

    this.candidates = withIndex.map((x) => x.v);
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      if (this.sortDirection === 'asc') this.sortDirection = 'desc';
      else if (this.sortDirection === 'desc') this.sortDirection = null;
      else this.sortDirection = 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    // if no direction, reset to scanned order
    if (!this.sortDirection) {
      this.candidates = this.scannedCandidates.slice();
    } else {
      this.applySort();
    }

    this.saveSortingToStorage();

    this.cdr.markForCheck();
  }

  private restoreFiltersFromStorage(): void {
    const saved = this.readFromStorage<ScannerFiltersStorage>(SCANNER_FILTERS_STORAGE_KEY);
    if (!saved || typeof saved !== 'object') {
      return;
    }

    const quoteCoin = typeof saved.quoteCoin === 'string' && saved.quoteCoin.trim().length > 0
      ? saved.quoteCoin.trim().toUpperCase()
      : 'USDC';

    const timeframe = this.normalizeTimeframe(saved.timeframe, '1h');
    const secondaryTimeframe = this.normalizeTimeframe(saved.secondaryTimeframe, '15m');
    const limit = this.normalizeLimit(saved.limit);
    const minTurnover = this.normalizeMinTurnover(saved.minTurnover);

    this.form.patchValue(
      {
        quoteCoin,
        timeframe,
        secondaryTimeframe,
        limit,
        minTurnover,
      },
      { emitEvent: false },
    );
  }

  private restoreSortingFromStorage(): void {
    const saved = this.readFromStorage<ScannerSortingStorage>(SCANNER_SORTING_STORAGE_KEY);
    if (!saved || typeof saved !== 'object') {
      return;
    }

    const sortColumn = typeof saved.sortColumn === 'string' && saved.sortColumn.length > 0
      ? saved.sortColumn
      : null;

    const sortDirection = saved.sortDirection === 'asc' || saved.sortDirection === 'desc' || saved.sortDirection === null
      ? saved.sortDirection
      : null;

    this.sortColumn = sortColumn;
    this.sortDirection = sortDirection;
  }

  private saveFiltersToStorage(): void {
    const raw = this.form.getRawValue();
    this.writeToStorage<ScannerFiltersStorage>(SCANNER_FILTERS_STORAGE_KEY, {
      quoteCoin: raw.quoteCoin,
      timeframe: raw.timeframe,
      secondaryTimeframe: raw.secondaryTimeframe,
      limit: this.normalizeLimit(raw.limit),
      minTurnover: this.normalizeMinTurnover(raw.minTurnover),
    });
  }

  private saveSortingToStorage(): void {
    this.writeToStorage<ScannerSortingStorage>(SCANNER_SORTING_STORAGE_KEY, {
      sortColumn: this.sortColumn,
      sortDirection: this.sortDirection,
    });
  }

  private normalizeTimeframe(value: unknown, fallback: ScannerTimeframe): ScannerTimeframe {
    return value === '1h' || value === '15m' ? value : fallback;
  }

  private normalizeLimit(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      return 100;
    }

    return Math.max(1, Math.min(500, Math.round(parsed)));
  }

  private normalizeMinTurnover(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      return 25000;
    }

    return Math.max(0, parsed);
  }

  private readFromStorage<T>(key: string): T | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private writeToStorage<T>(key: string, value: T): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore storage write failures
    }
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

  candidateEntryScore(candidate: ScannerCandidate): number {
    if (typeof candidate.entryScore === 'number' && Number.isFinite(candidate.entryScore)) {
      return candidate.entryScore;
    }

    const trend1h = candidate.analysis1h?.trendDirection;
    const trend15m = candidate.analysis15m?.trendDirection;
    const position = candidate.analysis15m?.positionInRangePercent ?? candidate.analysis1h?.positionInRangePercent ?? 50;
    const distSupport = candidate.analysis15m?.distanceToSupportPercent ?? candidate.analysis1h?.distanceToSupportPercent ?? 3;
    const distResistance = candidate.analysis15m?.distanceToResistancePercent ?? candidate.analysis1h?.distanceToResistancePercent ?? 3;
    const volatility = candidate.analysis15m?.volatilityPercent ?? candidate.analysis1h?.volatilityPercent ?? 1;

    let score = 50;

    score += trend1h === 'UP' ? 12 : trend1h === 'SIDEWAYS' ? 8 : -24;
    score += trend15m === 'UP' ? 10 : trend15m === 'SIDEWAYS' ? 6 : -20;

    if (position <= 30) score += 8;
    else if (position <= 65) score += 12;
    else if (position <= 75) score -= 6;
    else if (position <= 85) score -= 16;
    else score -= 24;

    score += distSupport <= 2.5 ? 8 : distSupport <= 4 ? 2 : -8;
    score += distResistance <= 1.2 ? -14 : distResistance <= 2 ? -8 : 4;
    score += volatility < 0.4 ? -8 : volatility > 0.8 ? 5 : 0;

    if (candidate.market.change24hPercent > 15) score -= 30;
    else if (candidate.market.change24hPercent > 12 && position >= 80) score -= 24;
    else if (candidate.market.change24hPercent > 8 && position >= 70) score -= 14;

    if (candidate.market.turnover24h < (this.form.controls.minTurnover.value ?? 25000)) {
      score -= 20;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  candidateEntryTiming(candidate: ScannerCandidate): EntryTiming {
    const provided = candidate.entryTiming as EntryTiming | undefined;
    if (provided) {
      return provided;
    }

    const score = this.candidateEntryScore(candidate);
    const trend1h = candidate.analysis1h?.trendDirection;
    const trend15m = candidate.analysis15m?.trendDirection;
    const position = candidate.analysis15m?.positionInRangePercent ?? candidate.analysis1h?.positionInRangePercent ?? 50;
    const distResistance = candidate.analysis15m?.distanceToResistancePercent ?? candidate.analysis1h?.distanceToResistancePercent ?? 3;
    const change24h = candidate.market.change24hPercent;

    if (trend1h === 'DOWN' && trend15m === 'DOWN') return 'NO_ENTRY';
    if (position >= 85) return 'WAIT_PULLBACK';
    if (change24h > 15) return 'NO_ENTRY';
    if (change24h > 8 && position >= 70) return 'WAIT_PULLBACK';
    if (position >= 70 || distResistance <= 1.2) return 'WAIT_PULLBACK';
    if (score >= 70) return 'READY';
    if (score >= 48) return 'WAIT_CONFIRMATION';
    return 'NO_ENTRY';
  }

  executionStatusClass(status: ExecutionStatus): string {
    if (status === 'READY') {
      return 'execution-ready';
    }

    if (status === 'UNAVAILABLE' || status === 'NO_ENTRY') {
      return 'execution-no-entry';
    }

    return 'execution-wait';
  }

  executionDecisionClass(decision: ExecutionDecision): string {
    if (decision === 'CAN_LAUNCH') {
      return 'decision-launch';
    }

    if (decision === 'DO_NOT_LAUNCH' || decision === 'UNAVAILABLE') {
      return 'decision-stop';
    }

    return 'decision-wait';
  }

  private loadUsdcExecution(candidate: ScannerCandidate): void {
    const analysisSymbol = candidate.symbol.toUpperCase();
    const requestId = ++this.usdcExecutionRequestId;

    this.usdcExecution = {
      analysisSymbol,
      analysisQuote: 'UNKNOWN',
      baseAsset: 'UNKNOWN',
      executionSymbol: '',
      executionMarket: '',
      executionQuote: 'USDC',
      available: false,
      isLoading: true,
      errorMessage: '',
      reason: 'Checking USDC execution pair availability...',
      liquidityDecision: 'N/A',
      executionStatus: 'UNAVAILABLE',
      marketSuitableForGrid: false,
      marketSuitabilityReason: 'Waiting for USDC pair availability check.',
      analysisStatus: candidate.status,
      analysisEntryTiming: this.candidateEntryTiming(candidate),
      analysisDecision: this.candidateExecutionDecision(candidate),
      executionEligibilityDecision: 'WAIT',
      decisionContext: 'Waiting for execution pair analysis.',
      entryTiming: 'WAIT_CONFIRMATION',
      entryScore: 0,
      status: 'WAIT_CONFIRMATION',
      decision: 'WAIT',
      checks: this.emptyExecutionChecks(false),
      failedOrImportantChecks: [],
      allChecks: [],
    };

    this.getExecutionMarketResolver()
      .pipe(
        switchMap((resolver) => {
          const resolution = resolver.resolveExecutionMarket(analysisSymbol);

          if (!resolution.executionAvailable) {
            return of({
              available: false as const,
              analysis1h: null,
              analysis15m: null,
              resolution,
            });
          }

          const executionSymbol = resolution.executionSymbol;

          return forkJoin({
            analysis1h: this.scannerService.getAnalysis(executionSymbol, '1h'),
            analysis15m: this.scannerService.getAnalysis(executionSymbol, '15m'),
          }).pipe(
            map(({ analysis1h, analysis15m }) => ({
              available: true as const,
              analysis1h,
              analysis15m,
              resolution,
            })),
          );
        }),
        catchError(() => {
          return of({
            available: false as const,
            analysis1h: null,
            analysis15m: null,
            resolution: {
              analysisSymbol,
              baseAsset: 'UNKNOWN',
              analysisQuote: 'UNKNOWN',
              executionSymbol: '',
              executionMarket: '',
              executionQuote: 'USDC',
              executionAvailable: false,
              reason: 'Unable to resolve execution market.',
            } satisfies ExecutionMarketResolution,
            error: 'Unable to load USDC execution data from Bybit at the moment.',
          });
        }),
      )
      .subscribe((result) => {
        if (requestId !== this.usdcExecutionRequestId) {
          return;
        }

        if (!result.available) {
          const resolution = result.resolution;
          const resolutionReason = resolution.reason ?? 'No corresponding USDC execution pair available.';
          const errorMessage = 'error' in result && result.error ? result.error : '';

          this.usdcExecution = {
            analysisSymbol: resolution.analysisSymbol,
            analysisQuote: resolution.analysisQuote,
            baseAsset: resolution.baseAsset,
            executionSymbol: resolution.executionSymbol,
            executionMarket: resolution.executionMarket,
            executionQuote: resolution.executionQuote,
            available: false,
            isLoading: false,
            errorMessage,
            reason: errorMessage || resolutionReason,
            liquidityDecision: 'N/A',
            executionStatus: 'UNAVAILABLE',
            marketSuitableForGrid: false,
            marketSuitabilityReason: 'Cannot evaluate grid suitability because the USDC execution pair is unavailable.',
            analysisStatus: candidate.status,
            analysisEntryTiming: this.candidateEntryTiming(candidate),
            analysisDecision: this.candidateExecutionDecision(candidate),
            executionEligibilityDecision: 'UNAVAILABLE',
            decisionContext: 'Execution pair is unavailable, so launch is not possible.',
            entryTiming: 'NO_ENTRY',
            entryScore: 0,
            status: 'UNAVAILABLE',
            decision: 'UNAVAILABLE',
            checks: this.emptyExecutionChecks(false),
            failedOrImportantChecks: [],
            allChecks: [],
          };
          this.cdr.markForCheck();
          return;
        }

        this.usdcExecution = this.buildUsdcExecutionSection(
          candidate,
          result.resolution,
          result.analysis1h,
          result.analysis15m,
        );
        this.cdr.markForCheck();
      });
  }

  private getExecutionMarketResolver(): Observable<ExecutionMarketResolver> {
    if (this.executionMarketResolver) {
      return of(this.executionMarketResolver);
    }

    return this.getSpotInstruments().pipe(
      map((instruments) => {
        this.executionMarketResolver = createExecutionMarketResolver(instruments);
        return this.executionMarketResolver;
      }),
    );
  }

  private getSpotInstruments(): Observable<MarketInstrument[]> {
    if (this.spotInstruments) {
      return of(this.spotInstruments);
    }

    if (this.spotInstrumentsRequest$) {
      return this.spotInstrumentsRequest$;
    }

    this.spotInstrumentsRequest$ = this.scannerService.getQuoteCoins().pipe(
      map((quoteCoins) => {
        const normalized = quoteCoins
          .map((quoteCoin) => quoteCoin.trim().toUpperCase())
          .filter((quoteCoin) => quoteCoin.length > 0);

        return [...new Set(normalized)];
      }),
      switchMap((quoteCoins) => {
        if (quoteCoins.length === 0) {
          return of([] as MarketInstrument[][]);
        }

        return forkJoin(
          quoteCoins.map((quoteCoin) =>
            this.scannerService.getMarketsByQuoteCoin(quoteCoin).pipe(catchError(() => of([]))),
          ),
        );
      }),
      map((marketGroups) => {
        const bySymbol = new Map<string, MarketInstrument>();
        for (const market of marketGroups.flat()) {
          const symbol = market.symbol.toUpperCase();
          const existing = bySymbol.get(symbol);
          if (!existing || existing.status.toUpperCase() !== 'TRADING') {
            bySymbol.set(symbol, {
              ...market,
              symbol,
              baseCoin: market.baseCoin.toUpperCase(),
              quoteCoin: market.quoteCoin.toUpperCase(),
              status: market.status,
            });
          }
        }

        return [...bySymbol.values()];
      }),
      tap((markets) => {
        this.spotInstruments = markets;
      }),
      catchError(() => {
        return of([] as MarketInstrument[]);
      }),
      tap(() => {
        this.spotInstrumentsRequest$ = null;
      }),
      shareReplay(1),
    );

    return this.spotInstrumentsRequest$;
  }

  private buildUsdcExecutionSection(
    candidate: ScannerCandidate,
    resolution: ExecutionMarketResolution,
    analysis1h: MarketAnalysis,
    analysis15m: MarketAnalysis,
  ): UsdcExecutionSection {
    const minTurnover = Math.max(0, this.form.controls.minTurnover.value ?? 25000);
    const supportResistanceValid = hasValidAnalysisStructure(analysis1h) && hasValidAnalysisStructure(analysis15m);
    const liquiditySufficient = analysis1h.turnover24h >= minTurnover;
    const lowLiquidity = !liquiditySufficient;
    const closeToSupport =
      analysis15m.distanceToSupportPercent <= 2.5 ||
      analysis1h.distanceToSupportPercent <= 3.5;
    const tooCloseToResistance =
      analysis15m.distanceToResistancePercent <= 1 ||
      analysis1h.distanceToResistancePercent <= 1.3;
    const high15mPosition = analysis15m.positionInRangePercent >= 70;
    const veryHigh15mPosition = analysis15m.positionInRangePercent >= 85;
    const breakoutRetestCandidate =
      !veryHigh15mPosition &&
      tooCloseToResistance &&
      high15mPosition &&
      analysis1h.trendDirection === 'UP' &&
      analysis15m.trendDirection === 'UP';
    const trend1hAcceptable = analysis1h.trendDirection !== 'DOWN';
    const trend15mAcceptable = analysis15m.trendDirection !== 'DOWN';
    const oneHourVolatilityVeryLow = analysis1h.volatilityPercent < 0.45;
    const low15mVolatility = analysis15m.volatilityPercent < 0.5;
    const volatilitySufficient = analysis1h.volatilityPercent >= 0.45 && analysis15m.volatilityPercent <= 8;
    const insideReasonableRange =
      analysis15m.positionInRangePercent >= 10 &&
      analysis15m.positionInRangePercent <= 85 &&
      analysis1h.positionInRangePercent >= 8 &&
      analysis1h.positionInRangePercent <= 90;
    const breakdownBelowSupport = analysis1h.price < Math.min(analysis1h.support, analysis15m.support) * 0.995;
    const strongPump = analysis1h.change24hPercent > 8 && analysis15m.positionInRangePercent >= 70;
    const severePump = analysis1h.change24hPercent > 12 && analysis15m.positionInRangePercent >= 80;
    const extremePump = analysis1h.change24hPercent > 15;

    const marketSuitableForGrid =
      supportResistanceValid &&
      !lowLiquidity &&
      !oneHourVolatilityVeryLow &&
      !breakdownBelowSupport &&
      analysis1h.trendDirection !== 'DOWN';

    let marketSuitabilityReason = 'GOOD FOR GRID: liquidity and 1H structure are acceptable.';
    if (!supportResistanceValid) {
      marketSuitabilityReason = 'WEAK FOR GRID: support/resistance data is invalid or unavailable.';
    } else if (lowLiquidity) {
      marketSuitabilityReason = 'WEAK FOR GRID: insufficient liquidity for reliable execution.';
    } else if (oneHourVolatilityVeryLow) {
      marketSuitabilityReason = 'WEAK FOR GRID: 1H volatility is too low for practical grid spacing.';
    } else if (breakdownBelowSupport) {
      marketSuitabilityReason = 'WEAK FOR GRID: price is breaking below key support.';
    } else if (analysis1h.trendDirection === 'DOWN') {
      marketSuitabilityReason = 'WEAK FOR GRID: 1H trend is down.';
    }

    let status: EntryTiming;
    if (!supportResistanceValid || !marketSuitableForGrid || severePump || extremePump) {
      status = 'NO_ENTRY';
    } else if (breakoutRetestCandidate) {
      status = 'WAIT_BREAKOUT_RETEST';
    } else if (veryHigh15mPosition) {
      status = 'WAIT_PULLBACK';
    } else if (high15mPosition) {
      status = 'WAIT_PULLBACK';
    } else if (strongPump) {
      status = 'WAIT_PULLBACK';
    } else if (tooCloseToResistance) {
      status = 'WAIT_BREAKOUT_RETEST';
    } else if (low15mVolatility && trend1hAcceptable && insideReasonableRange) {
      status = 'WAIT_CONFIRMATION';
    } else if (!closeToSupport) {
      status = 'WAIT_PULLBACK';
    } else if (!trend1hAcceptable || !trend15mAcceptable) {
      status = 'WAIT_CONFIRMATION';
    } else {
      status = 'READY';
    }

    const entryScore = this.calculateEntryScore({
      analysis1h,
      analysis15m,
      liquiditySufficient,
      closeToSupport,
      tooCloseToResistance,
      low15mVolatility,
      oneHourVolatilityVeryLow,
      breakdownBelowSupport,
      strongPump,
      severePump,
      extremePump,
      marketSuitableForGrid,
    });

    const risk = this.calculateRisk(analysis1h, analysis15m, liquiditySufficient, closeToSupport, tooCloseToResistance);
    const executionEligibilityDecision = this.calculateExecutionDecision(status, risk);
    const analysisDecision = this.candidateExecutionDecision(candidate);
    const decision = this.buildAuthoritativeExecutionDecision(analysisDecision, executionEligibilityDecision);
    const recommendation = this.buildGridRecommendation(analysis1h, analysis15m, status, risk, executionEligibilityDecision);

    const checks: ExecutionChecks = {
      usdcPairAvailable: true,
      suitableForSpotGrid: marketSuitableForGrid,
      liquiditySufficient,
      closeToSupport,
      tooCloseToResistance,
      trend1hAcceptable,
      trend15mAcceptable,
      volatilitySufficient,
      insideReasonableRange,
      supportResistanceValid,
    };

    const allChecks = this.buildExecutionCheckViews(checks);
    const failedOrImportantChecks = allChecks.filter((check) => check.important || !check.passed);

    const reason = this.executionReason(status, checks);
    const decisionContext = this.buildDecisionContext(analysisDecision, executionEligibilityDecision, decision);

    return {
      analysisSymbol: resolution.analysisSymbol,
      analysisQuote: resolution.analysisQuote,
      baseAsset: resolution.baseAsset,
      executionSymbol: resolution.executionSymbol,
      executionMarket: resolution.executionMarket,
      executionQuote: resolution.executionQuote,
      available: true,
      isLoading: false,
      errorMessage: '',
      reason,
      liquidityDecision: liquiditySufficient ? 'PASS' : 'FAIL',
      executionStatus: 'AVAILABLE',
      marketSuitableForGrid,
      marketSuitabilityReason,
      analysisStatus: candidate.status,
      analysisEntryTiming: this.candidateEntryTiming(candidate),
      analysisDecision,
      executionEligibilityDecision,
      decisionContext,
      entryTiming: status,
      entryScore,
      status,
      decision,
      market: {
        currentPrice: analysis1h.price,
        change24hPercent: analysis1h.change24hPercent,
        turnover24h: analysis1h.turnover24h,
      },
      analysis1h,
      analysis15m,
      checks,
      failedOrImportantChecks,
      allChecks,
      recommendation,
    };
  }

  private buildExecutionCheckViews(checks: ExecutionChecks): ExecutionCheckView[] {
    return [
      { key: 'usdcPairAvailable', label: 'USDC pair available', passed: checks.usdcPairAvailable, important: true },
      { key: 'suitableForSpotGrid', label: 'Suitable for spot grid', passed: checks.suitableForSpotGrid, important: true },
      { key: 'liquiditySufficient', label: 'Liquidity sufficient', passed: checks.liquiditySufficient, important: true },
      { key: 'supportResistanceValid', label: 'Support/resistance valid', passed: checks.supportResistanceValid, important: true },
      { key: 'trend1hAcceptable', label: '1H trend acceptable', passed: checks.trend1hAcceptable, important: true },
      { key: 'trend15mAcceptable', label: '15M trend acceptable', passed: checks.trend15mAcceptable, important: false },
      { key: 'closeToSupport', label: 'Price close to support', passed: checks.closeToSupport, important: false },
      {
        key: 'tooCloseToResistance',
        label: 'Not too close to resistance',
        passed: !checks.tooCloseToResistance,
        important: true,
      },
      { key: 'volatilitySufficient', label: 'Volatility sufficient', passed: checks.volatilitySufficient, important: false },
      { key: 'insideReasonableRange', label: 'Inside reasonable range', passed: checks.insideReasonableRange, important: false },
    ];
  }

  candidateExecutionDecision(candidate: ScannerCandidate): ExecutionDecision {
    const timing = this.candidateEntryTiming(candidate);

    if (candidate.status === 'REJECTED' || timing === 'NO_ENTRY') {
      return 'DO_NOT_LAUNCH';
    }

    if (candidate.status === 'CANDIDATE' && timing === 'READY') {
      return 'CAN_LAUNCH';
    }

    return 'WAIT';
  }

  private buildAuthoritativeExecutionDecision(
    analysisDecision: ExecutionDecision,
    executionEligibilityDecision: ExecutionDecision,
  ): ExecutionDecision {
    if (analysisDecision === 'UNAVAILABLE' || executionEligibilityDecision === 'UNAVAILABLE') {
      return 'UNAVAILABLE';
    }

    if (analysisDecision === 'DO_NOT_LAUNCH' || executionEligibilityDecision === 'DO_NOT_LAUNCH') {
      return 'DO_NOT_LAUNCH';
    }

    if (analysisDecision === 'CAN_LAUNCH' && executionEligibilityDecision === 'CAN_LAUNCH') {
      return 'CAN_LAUNCH';
    }

    return 'WAIT';
  }

  private buildDecisionContext(
    analysisDecision: ExecutionDecision,
    executionEligibilityDecision: ExecutionDecision,
    authoritativeDecision: ExecutionDecision,
  ): string {
    if (authoritativeDecision === 'UNAVAILABLE') {
      return 'Execution pair is unavailable.';
    }

    if (authoritativeDecision === 'DO_NOT_LAUNCH' && analysisDecision === 'DO_NOT_LAUNCH') {
      return 'Blocked by market analysis status for this snapshot.';
    }

    if (authoritativeDecision === 'DO_NOT_LAUNCH' && executionEligibilityDecision === 'DO_NOT_LAUNCH') {
      return 'Blocked by execution-pair eligibility checks.';
    }

    if (authoritativeDecision === 'WAIT') {
      return 'Market analysis and execution checks are not both launch-ready yet.';
    }

    return 'Market analysis and execution checks are aligned for launch.';
  }

  private emptyExecutionChecks(usdcPairAvailable: boolean): ExecutionChecks {
    return {
      usdcPairAvailable,
      suitableForSpotGrid: false,
      liquiditySufficient: false,
      closeToSupport: false,
      tooCloseToResistance: false,
      trend1hAcceptable: false,
      trend15mAcceptable: false,
      volatilitySufficient: false,
      insideReasonableRange: false,
      supportResistanceValid: false,
    };
  }

  private executionReason(status: ExecutionStatus, checks: ExecutionChecks): string {
    if (!checks.supportResistanceValid) {
      return 'Invalid support/resistance data for Grid execution.';
    }

    if (status === 'READY') {
      return 'USDC execution pair meets the Spot Grid entry requirements.';
    }

    if (status === 'WAIT_PULLBACK') {
      return 'Price is not close enough to support for an efficient grid entry.';
    }

    if (status === 'WAIT_BREAKOUT_RETEST') {
      return 'Price is too close to resistance. Wait for breakout-retest or pullback.';
    }

    if (status === 'WAIT_CONFIRMATION') {
      return 'Trend confirmation is not strong enough across 1H and 15M.';
    }

    if (!checks.liquiditySufficient) {
      return 'USDC pair liquidity is below the required threshold.';
    }

    if (!checks.volatilitySufficient) {
      return 'Volatility is outside the preferred range for grid trading.';
    }

    if (!checks.insideReasonableRange) {
      return 'Current market structure is outside a reasonable trading range.';
    }

    return 'Execution constraints are not satisfied.';
  }

  private calculateRisk(
    analysis1h: MarketAnalysis,
    analysis15m: MarketAnalysis,
    liquiditySufficient: boolean,
    closeToSupport: boolean,
    tooCloseToResistance: boolean,
  ): GridRisk {
    if (
      !liquiditySufficient ||
      analysis1h.trendDirection === 'DOWN' ||
      analysis15m.trendDirection === 'DOWN' ||
      tooCloseToResistance ||
      analysis15m.volatilityPercent > 5.5
    ) {
      return 'HIGH';
    }

    if (
      closeToSupport &&
      analysis1h.turnover24h >= 250000 &&
      analysis1h.trendDirection === 'UP' &&
      (analysis15m.trendDirection === 'UP' || analysis15m.trendDirection === 'SIDEWAYS') &&
      analysis15m.volatilityPercent >= 0.8 &&
      analysis15m.volatilityPercent <= 3.2
    ) {
      return 'LOW';
    }

    return 'MEDIUM';
  }

  private calculateExecutionDecision(status: EntryTiming, risk: GridRisk): ExecutionDecision {
    if (status === 'READY' && risk !== 'HIGH') {
      return 'CAN_LAUNCH';
    }

    if (status === 'NO_ENTRY') {
      return 'DO_NOT_LAUNCH';
    }

    return 'WAIT';
  }

  private buildGridRecommendation(
    analysis1h: MarketAnalysis,
    analysis15m: MarketAnalysis,
    status: EntryTiming,
    risk: GridRisk,
    executionDecision: ExecutionDecision,
  ): GridSetupRecommendation | undefined {
    if (status === 'NO_ENTRY') {
      return undefined;
    }

    const price = analysis1h.price;
    const entryZone = this.buildEntryZone(status, analysis1h, analysis15m);
    const gridRange = this.buildGridRange(status, analysis1h, analysis15m, entryZone);
    const gridCount = this.buildGridCount(gridRange.gridLow, gridRange.gridHigh, price, analysis15m.volatilityPercent, risk);

    const stopLoss = gridRange.gridLow * (risk === 'HIGH' ? 0.99 : 0.985);
    const takeProfit = gridRange.gridHigh * (executionDecision === 'CAN_LAUNCH' ? 1.012 : 1.007);
    const trailingUp =
      status === 'READY' &&
      analysis1h.trendDirection === 'UP' &&
      analysis15m.trendDirection === 'UP' &&
      analysis1h.change24hPercent > 3 &&
      analysis15m.positionInRangePercent >= 55 &&
      analysis15m.distanceToSupportPercent <= 2.2;
    const trailingStopPercent = this.buildTrailingStopPercent(analysis15m.volatilityPercent, risk);

    return {
      investmentUsdc: 200,
      entryLow: entryZone.entryLow,
      entryHigh: entryZone.entryHigh,
      gridLow: gridRange.gridLow,
      gridHigh: gridRange.gridHigh,
      gridCount,
      stopLoss,
      takeProfit,
      trailingUp,
      trailingStopPercent,
      risk,
      executionDecision,
    };
  }

  private buildEntryZone(
    status: EntryTiming,
    analysis1h: MarketAnalysis,
    analysis15m: MarketAnalysis,
  ): { entryLow: number; entryHigh: number } {
    const price = analysis1h.price;
    const support1h = analysis1h.support;
    const support15m = analysis15m.support;
    const resistance1h = analysis1h.resistance;
    const resistance15m = analysis15m.resistance;
    const supportAnchor = Math.max(Math.min(support1h, support15m), price * 0.8);
    const nearSupport = Math.max(support1h, support15m);
    const volFactor = this.clamp(analysis15m.volatilityPercent / 100, 0.004, 0.03);

    if (status === 'WAIT_PULLBACK') {
      const pullbackHighRaw = nearSupport + (price - nearSupport) * 0.35;
      let entryHigh = Math.min(price * 0.992, pullbackHighRaw * (1 + volFactor * 0.45));
      let entryLow = Math.max(supportAnchor, entryHigh * (1 - this.clamp(volFactor * 2.2, 0.015, 0.05)));

      if (entryHigh >= price) {
        entryHigh = price * 0.992;
      }

      if (entryLow >= entryHigh) {
        entryLow = Math.max(supportAnchor, entryHigh * 0.975);
      }

      return { entryLow, entryHigh };
    }

    if (status === 'WAIT_BREAKOUT_RETEST') {
      const retestBase = Math.min(Math.max(resistance15m, support15m), resistance1h);
      const retestBand = this.clamp(volFactor * 1.4, 0.006, 0.025);
      const entryLow = retestBase * (1 - retestBand);
      const entryHigh = retestBase * (1 + retestBand * 0.65);
      return this.normalizeZone(entryLow, entryHigh, price);
    }

    if (status === 'WAIT_CONFIRMATION') {
      const midpoint = (support15m + resistance15m) / 2;
      const widthPct = this.clamp(volFactor * 1.8, 0.01, 0.03);
      const entryLow = Math.min(midpoint, price) * (1 - widthPct);
      const entryHigh = Math.max(midpoint, price) * (1 + widthPct * 0.4);
      return this.normalizeZone(entryLow, entryHigh, price);
    }

    const readyWidthPct = this.clamp(volFactor * 1.25, 0.006, 0.02);
    const readyLow = Math.max(support15m, price * (1 - readyWidthPct));
    const readyHigh = Math.min(resistance15m, price * (1 + readyWidthPct * 0.85));
    return this.normalizeZone(readyLow, readyHigh, price);
  }

  private buildGridRange(
    status: EntryTiming,
    analysis1h: MarketAnalysis,
    analysis15m: MarketAnalysis,
    entryZone: { entryLow: number; entryHigh: number },
  ): { gridLow: number; gridHigh: number } {
    const price = analysis1h.price;
    const supportFloor = Math.min(analysis1h.support, analysis15m.support, entryZone.entryLow);
    const resistanceCeiling = Math.max(analysis1h.resistance, analysis15m.resistance, entryZone.entryHigh);
    const vol15 = this.clamp(analysis15m.volatilityPercent / 100, 0.004, 0.08);
    const oneHourRange = this.clamp(analysis1h.rangePercent / 100, 0.03, 0.2);

    const targetCenter =
      status === 'WAIT_PULLBACK'
        ? (entryZone.entryLow + entryZone.entryHigh) / 2
        : status === 'WAIT_BREAKOUT_RETEST'
          ? entryZone.entryLow
          : price;

    const maxWidthPct = this.clamp(oneHourRange * 0.75, 0.06, 0.18);
    const minWidthPct = this.clamp(vol15 * 2.8, 0.035, 0.09);

    let gridLow = Math.max(supportFloor, targetCenter * (1 - maxWidthPct * 0.95));
    let gridHigh = Math.min(resistanceCeiling, targetCenter * (1 + maxWidthPct));

    if (gridHigh <= gridLow) {
      gridLow = targetCenter * (1 - minWidthPct / 2);
      gridHigh = targetCenter * (1 + minWidthPct / 2);
    }

    const currentWidthPct = (gridHigh - gridLow) / targetCenter;
    if (currentWidthPct < minWidthPct) {
      const half = (targetCenter * minWidthPct) / 2;
      gridLow = Math.max(supportFloor, targetCenter - half);
      gridHigh = Math.min(resistanceCeiling, targetCenter + half);
    }

    if (gridHigh <= gridLow) {
      gridLow = supportFloor;
      gridHigh = Math.max(resistanceCeiling, supportFloor * 1.03);
    }

    return { gridLow, gridHigh };
  }

  private buildGridCount(
    gridLow: number,
    gridHigh: number,
    price: number,
    volatility15mPercent: number,
    risk: GridRisk,
  ): number {
    const spanPercent = ((gridHigh - gridLow) / price) * 100;
    let gridCount = 10;

    if (spanPercent < 3) {
      gridCount = 8;
    } else if (spanPercent < 5) {
      gridCount = 9;
    } else if (spanPercent < 7) {
      gridCount = 10;
    } else if (spanPercent < 9) {
      gridCount = 11;
    } else {
      gridCount = 12;
    }

    if (spanPercent > 12 && volatility15mPercent > 3.5) {
      gridCount = 14;
    }

    if (spanPercent > 16 && volatility15mPercent > 5) {
      gridCount = 15;
    }

    if (risk === 'LOW') {
      gridCount += 1;
    } else if (risk === 'HIGH') {
      gridCount -= 1;
    }

    return Math.max(8, Math.min(15, gridCount));
  }

  private buildTrailingStopPercent(volatility15mPercent: number, risk: GridRisk): number {
    let trailingStop = 4 + (volatility15mPercent - 2) * 0.35;

    if (risk === 'HIGH') {
      trailingStop += 0.25;
    } else if (risk === 'LOW') {
      trailingStop -= 0.2;
    }

    return this.clamp(trailingStop, 3, 5);
  }

  private calculateEntryScore(input: {
    analysis1h: MarketAnalysis;
    analysis15m: MarketAnalysis;
    liquiditySufficient: boolean;
    closeToSupport: boolean;
    tooCloseToResistance: boolean;
    low15mVolatility: boolean;
    oneHourVolatilityVeryLow: boolean;
    breakdownBelowSupport: boolean;
    strongPump: boolean;
    severePump: boolean;
    extremePump: boolean;
    marketSuitableForGrid: boolean;
  }): number {
    const {
      analysis1h,
      analysis15m,
      liquiditySufficient,
      closeToSupport,
      tooCloseToResistance,
      low15mVolatility,
      oneHourVolatilityVeryLow,
      breakdownBelowSupport,
      strongPump,
      severePump,
      extremePump,
      marketSuitableForGrid,
    } = input;

    let score = 50;

    score += analysis1h.trendDirection === 'UP' ? 14 : analysis1h.trendDirection === 'SIDEWAYS' ? 10 : -30;
    score += analysis15m.trendDirection === 'UP' ? 12 : analysis15m.trendDirection === 'SIDEWAYS' ? 8 : -24;

    const position = analysis15m.positionInRangePercent;
    if (position <= 30) score += 8;
    else if (position <= 65) score += 12;
    else if (position <= 75) score -= 6;
    else if (position <= 85) score -= 18;
    else score -= 28;

    score += closeToSupport ? 8 : -6;
    score += tooCloseToResistance ? -16 : 4;

    if (low15mVolatility) score -= 8;
    if (oneHourVolatilityVeryLow) score -= 18;
    if (analysis15m.volatilityPercent >= 0.8 && analysis15m.volatilityPercent <= 3.5) score += 6;

    if (!liquiditySufficient) score -= 24;
    if (breakdownBelowSupport) score -= 30;
    if (strongPump) score -= 12;
    if (severePump) score -= 18;
    if (extremePump) score -= 24;
    if (!marketSuitableForGrid) score -= 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private normalizeZone(entryLow: number, entryHigh: number, price: number): { entryLow: number; entryHigh: number } {
    let low = Math.max(Math.min(entryLow, entryHigh), price * 0.75);
    let high = Math.min(Math.max(entryLow, entryHigh), price * 1.25);

    if (high <= low) {
      low = price * 0.99;
      high = price * 1.01;
    }

    return { entryLow: low, entryHigh: high };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
