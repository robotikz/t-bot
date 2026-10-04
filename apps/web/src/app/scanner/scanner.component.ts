import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
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
export class ScannerComponent {
  private readonly scannerService = inject(ScannerService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly form = this.fb.nonNullable.group({
    timeframe: this.fb.nonNullable.control<'1h' | '15m'>('1h'),
    secondaryTimeframe: this.fb.nonNullable.control<'1h' | '15m'>('15m'),
    limit: this.fb.nonNullable.control<number>(10, [Validators.min(1), Validators.max(100)]),
    minTurnover: this.fb.nonNullable.control<number | null>(1000000),
  });

  state: ViewState = 'initial';
  isLoading = false;
  errorMessage = '';
  candidates: ScannerCandidate[] = [];
  selectedCandidate: ScannerCandidate | null = null;

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
