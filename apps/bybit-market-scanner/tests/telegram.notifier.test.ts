import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TelegramNotifier } from '../src/modules/monitoring/telegram.notifier.js';

describe('TelegramNotifier', () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    // set on globalThis to satisfy environment
    (globalThis as any).fetch = fetchMock;
  });

  it('sends READY message with setup', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const notifier = new TelegramNotifier({ enabled: true, token: 'T_TOKEN', chatId: '123' });

    const event = {
      symbol: 'ABCUSDT',
      fromState: 'WATCH',
      toState: 'READY',
      observation: {
        setup: { entryLow: 1, entryHigh: 2, gridLow: 1, gridHigh: 10, gridCount: 5, stopLoss: 0.9, takeProfit: 12, investment: 100, risk: 'LOW' },
        confidence: 85,
        pairValidation: { status: 'USDC_READY' },
        generatedAt: '2026-10-08T00:00:00Z'
      },
      transition: {}
    };

    await notifier.notify(event as any);
    expect(fetchMock).toHaveBeenCalled();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/botT_TOKEN/sendMessage');
    const body = JSON.parse(opts.body as string);
    expect(body.chat_id).toBe('123');
    expect(body.text).toContain('GRID READY');
    expect(body.text).toContain('Entry');
  });

  it('is disabled when not configured', async () => {
    const fetchSpy = vi.fn();
    (globalThis as any).fetch = fetchSpy;
    const notifier = new TelegramNotifier({ enabled: false });
    await notifier.notify({ symbol: 'X', toState: 'WATCH', observation: {}, transition: {} } as any);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('handles HTTP failure gracefully', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'err' });
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notifier = new TelegramNotifier({ enabled: true, token: 'T', chatId: '1' });
    await notifier.notify({ symbol: 'X', toState: 'WATCH', observation: {}, transition: {} } as any);
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });
});
