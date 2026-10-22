import { Component, ElementRef, EventEmitter, HostListener, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-scanner-info-dialog',
  standalone: true,
  templateUrl: './scanner-info-dialog.component.html',
  styleUrl: './scanner-info-dialog.component.scss',
})
export class ScannerInfoDialogComponent {
  @Output() close = new EventEmitter<void>();
  @ViewChild('dialogPanel') dialogPanel?: ElementRef<HTMLElement>;
  private previousFocusedElement: HTMLElement | null = null;

  ngOnInit(): void {
    this.previousFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setTimeout(() => this.dialogPanel?.nativeElement.focus(), 0);
  }

  ngOnDestroy(): void {
    this.previousFocusedElement?.focus();
  }

  requestClose(): void {
    this.close.emit();
  }

  stopEvent(event: Event): void {
    event.stopPropagation();
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.requestClose();
    }
  }
}
