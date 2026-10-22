import { CommonModule } from '@angular/common';
import { Component, HostListener, Input } from '@angular/core';

@Component({
  selector: 'app-scanner-header-help',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scanner-header-help.component.html',
  styleUrl: './scanner-header-help.component.scss',
})
export class ScannerHeaderHelpComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) helpText = '';

  isOpen = false;

  get tooltipId(): string {
    const normalized = this.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `scanner-tooltip-${normalized || 'help'}`;
  }

  open(event?: Event): void {
    event?.stopPropagation();
    this.isOpen = true;
  }

  toggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  close(event?: Event): void {
    event?.stopPropagation();
    this.isOpen = false;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.isOpen) {
      this.isOpen = false;
    }
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen) {
      this.isOpen = false;
    }
  }
}
