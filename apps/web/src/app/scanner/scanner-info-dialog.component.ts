import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-scanner-info-dialog',
  standalone: true,
  templateUrl: './scanner-info-dialog.component.html',
  styleUrl: './scanner-info-dialog.component.scss',
})
export class ScannerInfoDialogComponent {
  @Output() close = new EventEmitter<void>();

  requestClose(): void {
    this.close.emit();
  }

  stopEvent(event: Event): void {
    event.stopPropagation();
  }
}
