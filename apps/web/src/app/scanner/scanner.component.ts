import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { MarketAnalysis, ScannerCandidate, ScannerService } from './scanner.service';

type ViewState = 'initial' | 'loading' | 'success' | 'empty' | 'error';
type ExecutionStatus = 'READY' | 'WAIT_PULLBACK' | 'WAIT_BREAKOUT_RETEST' | 'WAIT_CONFIRMATION' | 'NO_ENTRY' | 'UNAVAILABLE';
type ExecutionDecision = 'CAN LAUNCH' | 'WAIT' | 'DO NOT LAUNCH';
type GridRisk = 'LOW' | 'MEDIUM' | 'HIGH';

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
  analysisPairSymbol: string;
  executionPairSymbol: string;
  available: boolean;
  isLoading: boolean;
  errorMessage: string;
  reason: string;
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
  recommendation?: GridSetupRecommendation;
}

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './scanner.component.html',
  styleUrl: './scanner.component.scss',
})
export class ScannerComponent {
  private readonly scannerService = inject(ScannerService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private usdcExecutionRequestId = 0;

  quoteCoins: string[] = ['USDT'];
  isFiltersExpanded = false;

  readonly form = this.fb.nonNullable.group({
    quoteCoin: this.fb.nonNullable.control<string>('USDT'),
    timeframe: this.fb.nonNullable.control<'1h' | '15m'>('1h'),
    secondaryTimeframe: this.fb.nonNullable.control<'1h' | '15m'>('15m'),
    limit: this.fb.nonNullable.control<number>(100, [Validators.min(1), Validators.max(500)]),
    minTurnover: this.fb.nonNullable.control<number | null>(10000),
  });

  state: ViewState = 'initial';
  isLoading = false;
  errorMessage = '';
  candidates: ScannerCandidate[] = [];
  selectedCandidate: ScannerCandidate | null = null;
  usdcExecution: UsdcExecutionSection | null = null;

  constructor() {
    this.scannerService.getQuoteCoins().pipe(
      map((quoteCoins) => (quoteCoins.length > 0 ? quoteCoins : ['USDT'])),
      catchError((error) => {
        return of(['USDT']);
      }),
    ).subscribe((quoteCoins) => {
      this.quoteCoins = quoteCoins;

      if (!quoteCoins.includes(this.form.controls.quoteCoin.value)) {
        this.form.controls.quoteCoin.setValue(quoteCoins[0] ?? 'USDT');
      }

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
        const candidates = Array.isArray(result?.candidates) ? [...result.candidates].sort((left, right) => right.score - left.score) : [];

        this.candidates = candidates;
        this.selectedCandidate = candidates[0] ?? null;
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
    this.loadUsdcExecution(candidate);
    this.cdr.markForCheck();
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
          'USDC EXECUTION / GRID BOT',
          '==========================',
          `USDT Analysis Pair: ${this.usdcExecution.analysisPairSymbol}`,
          `USDC Execution Pair: ${this.usdcExecution.executionPairSymbol}`,
          `USDC Pair Available: ${this.usdcExecution.available ? 'YES' : 'NO'}`,
          `Execution Status: ${this.usdcExecution.status}`,
          `Execution Decision: ${this.usdcExecution.decision}`,
          `Reason: ${this.usdcExecution.reason}`,
        ]
      : [];

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
      ...usdcExecutionText,
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
    if (decision === 'CAN LAUNCH') {
      return 'decision-launch';
    }

    if (decision === 'DO NOT LAUNCH') {
      return 'decision-stop';
    }

    return 'decision-wait';
  }

  private loadUsdcExecution(candidate: ScannerCandidate): void {
    const analysisPairSymbol = candidate.symbol.toUpperCase();
    const executionPairSymbol = this.toUsdcExecutionSymbol(analysisPairSymbol);
    const requestId = ++this.usdcExecutionRequestId;

    this.usdcExecution = {
      analysisPairSymbol,
      executionPairSymbol,
      available: false,
      isLoading: true,
      errorMessage: '',
      reason: 'Checking USDC execution pair availability...',
      status: 'WAIT_CONFIRMATION',
      decision: 'WAIT',
      checks: this.emptyExecutionChecks(false),
    };

    this.scannerService
      .getMarketsByQuoteCoin('USDC')
      .pipe(
        switchMap((markets) => {
          const available = markets.some((market) => market.symbol.toUpperCase() === executionPairSymbol);

          if (!available) {
            return of({
              available: false as const,
              analysis1h: null,
              analysis15m: null,
            });
          }

          return forkJoin({
            analysis1h: this.scannerService.getAnalysis(executionPairSymbol, '1h'),
            analysis15m: this.scannerService.getAnalysis(executionPairSymbol, '15m'),
          }).pipe(
            map(({ analysis1h, analysis15m }) => ({
              available: true as const,
              analysis1h,
              analysis15m,
            })),
          );
        }),
        catchError(() => {
          return of({
            available: false as const,
            analysis1h: null,
            analysis15m: null,
            error: 'Unable to load USDC execution data from Bybit at the moment.',
          });
        }),
      )
      .subscribe((result) => {
        if (requestId !== this.usdcExecutionRequestId) {
          return;
        }

        if (!result.available) {
          const errorMessage = 'error' in result && result.error ? result.error : '';

          this.usdcExecution = {
            analysisPairSymbol,
            executionPairSymbol,
            available: false,
            isLoading: false,
            errorMessage,
            reason: errorMessage || 'No corresponding USDC execution pair available.',
            status: 'UNAVAILABLE',
            decision: 'DO NOT LAUNCH',
            checks: this.emptyExecutionChecks(false),
          };
          this.cdr.markForCheck();
          return;
        }

        this.usdcExecution = this.buildUsdcExecutionSection(
          analysisPairSymbol,
          executionPairSymbol,
          result.analysis1h,
          result.analysis15m,
        );
        this.cdr.markForCheck();
      });
  }

  private toUsdcExecutionSymbol(usdtSymbol: string): string {
    const normalized = usdtSymbol.toUpperCase();

    if (normalized.endsWith('USDT')) {
      const baseAsset = normalized.slice(0, -4);
      return `${baseAsset}USDC`;
    }

    return `${normalized}USDC`;
  }

  private buildUsdcExecutionSection(
    analysisPairSymbol: string,
    executionPairSymbol: string,
    analysis1h: MarketAnalysis,
    analysis15m: MarketAnalysis,
  ): UsdcExecutionSection {
    const minTurnover = Math.max(10000, this.form.controls.minTurnover.value ?? 0);
    const liquiditySufficient = analysis1h.turnover24h >= minTurnover;
    const closeToSupport =
      analysis15m.distanceToSupportPercent <= 2.5 ||
      analysis1h.distanceToSupportPercent <= 3.5;
    const tooCloseToResistance =
      analysis15m.distanceToResistancePercent <= 1 ||
      analysis1h.distanceToResistancePercent <= 1.3;
    const high15mPosition = analysis15m.positionInRangePercent >= 75;
    const veryHigh15mPosition = analysis15m.positionInRangePercent >= 85;
    const breakoutRetestCandidate =
      tooCloseToResistance &&
      high15mPosition &&
      analysis1h.trendDirection === 'UP' &&
      analysis15m.trendDirection === 'UP';
    const trend1hAcceptable = analysis1h.trendDirection !== 'DOWN';
    const trend15mAcceptable = analysis15m.trendDirection !== 'DOWN';
    const volatilitySufficient = analysis15m.volatilityPercent >= 0.35 && analysis15m.volatilityPercent <= 8;
    const insideReasonableRange =
      analysis15m.positionInRangePercent >= 10 &&
      analysis15m.positionInRangePercent <= 85 &&
      analysis1h.positionInRangePercent >= 8 &&
      analysis1h.positionInRangePercent <= 90;

    const suitableForSpotGrid =
      liquiditySufficient &&
      trend1hAcceptable &&
      trend15mAcceptable &&
      volatilitySufficient &&
      insideReasonableRange &&
      !tooCloseToResistance;

    let status: ExecutionStatus;
    if (!liquiditySufficient || !volatilitySufficient || !insideReasonableRange) {
      status = 'NO_ENTRY';
    } else if (veryHigh15mPosition) {
      status = 'WAIT_PULLBACK';
    } else if (breakoutRetestCandidate) {
      status = 'WAIT_BREAKOUT_RETEST';
    } else if (high15mPosition) {
      status = 'WAIT_PULLBACK';
    } else if (tooCloseToResistance) {
      status = 'WAIT_BREAKOUT_RETEST';
    } else if (!closeToSupport) {
      status = 'WAIT_PULLBACK';
    } else if (!trend1hAcceptable || !trend15mAcceptable) {
      status = 'WAIT_CONFIRMATION';
    } else {
      status = 'READY';
    }

    const risk = this.calculateRisk(analysis1h, analysis15m, liquiditySufficient, closeToSupport, tooCloseToResistance);
    const decision = this.calculateExecutionDecision(status, risk);
    const recommendation = this.buildGridRecommendation(analysis1h, analysis15m, status, risk, decision);

    const reason = this.executionReason(status, {
      liquiditySufficient,
      closeToSupport,
      tooCloseToResistance,
      trend1hAcceptable,
      trend15mAcceptable,
      volatilitySufficient,
      insideReasonableRange,
      suitableForSpotGrid,
      usdcPairAvailable: true,
    });

    return {
      analysisPairSymbol,
      executionPairSymbol,
      available: true,
      isLoading: false,
      errorMessage: '',
      reason,
      status,
      decision,
      market: {
        currentPrice: analysis1h.price,
        change24hPercent: analysis1h.change24hPercent,
        turnover24h: analysis1h.turnover24h,
      },
      analysis1h,
      analysis15m,
      checks: {
        usdcPairAvailable: true,
        suitableForSpotGrid,
        liquiditySufficient,
        closeToSupport,
        tooCloseToResistance,
        trend1hAcceptable,
        trend15mAcceptable,
        volatilitySufficient,
        insideReasonableRange,
      },
      recommendation,
    };
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
    };
  }

  private executionReason(status: ExecutionStatus, checks: ExecutionChecks): string {
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

  private calculateExecutionDecision(status: ExecutionStatus, risk: GridRisk): ExecutionDecision {
    if (status === 'READY' && risk !== 'HIGH') {
      return 'CAN LAUNCH';
    }

    if (status === 'UNAVAILABLE' || status === 'NO_ENTRY') {
      return 'DO NOT LAUNCH';
    }

    return 'WAIT';
  }

  private buildGridRecommendation(
    analysis1h: MarketAnalysis,
    analysis15m: MarketAnalysis,
    status: ExecutionStatus,
    risk: GridRisk,
    executionDecision: ExecutionDecision,
  ): GridSetupRecommendation | undefined {
    if (status === 'NO_ENTRY' || status === 'UNAVAILABLE') {
      return undefined;
    }

    const price = analysis1h.price;
    const entryZone = this.buildEntryZone(status, analysis1h, analysis15m);
    const gridRange = this.buildGridRange(status, analysis1h, analysis15m, entryZone);
    const gridCount = this.buildGridCount(gridRange.gridLow, gridRange.gridHigh, price, analysis15m.volatilityPercent, risk);

    const stopLoss = gridRange.gridLow * (risk === 'HIGH' ? 0.99 : 0.985);
    const takeProfit = gridRange.gridHigh * (executionDecision === 'CAN LAUNCH' ? 1.012 : 1.007);
    const trailingUp = analysis1h.trendDirection === 'UP';
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
    status: ExecutionStatus,
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
    status: ExecutionStatus,
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
