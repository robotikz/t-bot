import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input, ViewChild } from '@angular/core';

@Component({
  selector: 'app-scanner-header-help',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scanner-header-help.component.html',
  styleUrl: './scanner-header-help.component.scss',
})
export class ScannerHeaderHelpComponent {
  private static activeInstanceId: string | null = null;

  @Input({ required: true }) label = '';
  @Input({ required: true }) helpText = '';
  @ViewChild('tooltipEl') tooltipEl?: ElementRef<HTMLDivElement>;

  readonly instanceId = `help-${Math.random().toString(36).slice(2, 10)}`;
  tooltipStyle: Record<string, string> = {};

  constructor(private readonly hostRef: ElementRef<HTMLElement>) {}

  get isOpen(): boolean {
    return ScannerHeaderHelpComponent.activeInstanceId === this.instanceId;
  }

  get tooltipId(): string {
    const normalized = this.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `scanner-tooltip-${normalized || 'help'}`;
  }

  open(event?: Event): void {
    event?.stopPropagation();
    ScannerHeaderHelpComponent.activeInstanceId = this.instanceId;
    this.updateTooltipPosition();
  }

  toggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    ScannerHeaderHelpComponent.activeInstanceId = this.isOpen ? null : this.instanceId;
    this.updateTooltipPosition();
  }

  close(event?: Event): void {
    event?.stopPropagation();
    if (this.isOpen) {
      ScannerHeaderHelpComponent.activeInstanceId = null;
    }
  }

  @HostListener('mouseenter', ['$event'])
  onMouseEnter(event: MouseEvent): void {
    this.open(event);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.close();
  }

  @HostListener('focusin', ['$event'])
  onFocusIn(event: FocusEvent): void {
    this.open(event);
  }

  @HostListener('focusout', ['$event'])
  onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && this.hostRef.nativeElement.contains(next)) {
      return;
    }
    this.close();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.close();
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen) {
      this.close();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.isOpen) {
      this.updateTooltipPosition();
    }
  }

  private updateTooltipPosition(): void {
    if (!this.isOpen) {
      return;
    }

    requestAnimationFrame(() => {
      const host = this.hostRef.nativeElement;
      const tooltip = this.tooltipEl?.nativeElement;
      if (!tooltip) {
        return;
      }

      const hostRect = host.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const margin = 10;
      const gap = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const showBelow = hostRect.bottom + gap + tooltipRect.height <= viewportHeight - margin;
      const top = showBelow
        ? hostRect.bottom + gap
        : Math.max(margin, hostRect.top - tooltipRect.height - gap);

      const preferredLeft = hostRect.left + hostRect.width / 2 - tooltipRect.width / 2;
      const left = Math.min(
        Math.max(preferredLeft, margin),
        Math.max(margin, viewportWidth - tooltipRect.width - margin),
      );

      this.tooltipStyle = {
        position: 'fixed',
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
      };
    });
  }
}
