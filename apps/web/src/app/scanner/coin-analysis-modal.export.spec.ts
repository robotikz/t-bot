// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildChartsExportCanvas } from './coin-analysis-modal.component';

describe('coin-analysis-modal chart export', () => {
  const drawImageCalls: Array<{ image: HTMLCanvasElement; x: number; y: number }> = [];
  const fillTextCalls: Array<{ text: string; x: number; y: number }> = [];
  let canvasPrototype: any;
  let originalGetContext: any;
  let originalRequestAnimationFrame: typeof requestAnimationFrame;

  beforeEach(() => {
    drawImageCalls.length = 0;
    fillTextCalls.length = 0;
    canvasPrototype = Object.getPrototypeOf(document.createElement('canvas'));
    originalGetContext = canvasPrototype.getContext;
    originalRequestAnimationFrame = globalThis.requestAnimationFrame;

    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    });

    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    }) as typeof requestAnimationFrame;

    canvasPrototype.getContext = vi.fn(() => ({
      fillStyle: '#fff',
      font: '',
      textBaseline: 'alphabetic',
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      fillRect: vi.fn(),
      drawImage: vi.fn((image: HTMLCanvasElement, x: number, y: number) => {
        drawImageCalls.push({ image, x, y });
      }),
      fillText: vi.fn((text: string, x: number, y: number) => {
        fillTextCalls.push({ text, x, y });
      }),
    }) as any);
  });

  afterEach(() => {
    if (canvasPrototype && originalGetContext) {
      canvasPrototype.getContext = originalGetContext;
    }
    if (originalRequestAnimationFrame) {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it('composes full chart screenshots with headings and padding', async () => {
    const screenshot1h = document.createElement('canvas');
    screenshot1h.width = 900;
    screenshot1h.height = 420;

    const screenshot15m = document.createElement('canvas');
    screenshot15m.width = 900;
    screenshot15m.height = 360;

    const chart1h = { takeScreenshot: vi.fn(() => screenshot1h) };
    const chart15m = { takeScreenshot: vi.fn(() => screenshot15m) };

    const exportCanvas = await buildChartsExportCanvas(chart1h, chart15m, 'PEPEUSDC');

    expect(exportCanvas).not.toBeNull();
    expect(chart1h.takeScreenshot).toHaveBeenCalledWith(true, false);
    expect(chart15m.takeScreenshot).toHaveBeenCalledWith(true, false);
    expect(fillTextCalls).toEqual([
      { text: 'PEPEUSDC · 1H', x: 24, y: 24 },
      { text: 'PEPEUSDC · 15M', x: 24, y: 506 },
    ]);
    expect(drawImageCalls).toEqual([
      { image: screenshot1h, x: 24, y: 58 },
      { image: screenshot15m, x: 24, y: 540 },
    ]);
    expect(exportCanvas?.width).toBe(948);
    expect(exportCanvas?.height).toBe(924);
  });
});
