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
    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain('/botT_TOKEN/sendMessage');
    const body = JSON.parse(opts.body as string);
    expect(body.chat_id).toBe('123');
    expect(body.text).toContain('GRID READY');
    expect(body.text).toContain('Entry');
  });

  it('handles Telegram API ok:false responses', async () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    // fetch returns http 200 but telegram payload ok:false
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: false, description: 'bot banned' }) });
    const notifier = new TelegramNotifier({ enabled: true, token: 'T_TOKEN', chatId: '123' });
    await notifier.notify({ symbol: 'BAD<symbol>', fromState: 'READY', toState: 'WATCH', observation: { generatedAt: '2026-10-08T00:00:00Z' } } as any);
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });

  it('handles fetch/timeout errors gracefully', async () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    // simulate fetch throwing due to abort/timeout
    fetchMock.mockRejectedValue(new Error('AbortError'));
    const notifier = new TelegramNotifier({ enabled: true, token: 'T_TOKEN', chatId: '123' });
    await notifier.notify({ symbol: 'TIMEOUT', fromState: 'READY', toState: 'WATCH', observation: {} } as any);
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });

  it('escapes HTML in symbol and reasons', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const notifier = new TelegramNotifier({ enabled: true, token: 'T_TOKEN', chatId: '123' });
    const event = {
      symbol: '<X&Y>',
      fromState: 'READY',
      toState: 'WATCH',
      observation: { reasons: ['bad<bad>'] },
      transition: {}
    };
    await notifier.notify(event as any);
    const [, opts] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    const body = JSON.parse(opts.body as string);
    expect(body.text).not.toContain('<X&Y>');
    expect(body.text).toContain('&lt;X&amp;Y&gt;');
    expect(body.text).toContain('&lt;bad&gt;');
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
