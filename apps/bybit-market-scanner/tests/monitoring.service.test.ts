import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MonitoringService } from '../src/modules/monitoring/monitoring.service.js';

class DummyNotifier {
  public events: any[] = [];
  async notify(event: any) {
    this.events.push(event);
  }
}

function makeSignal(symbol: string, state: string, prev?: string) {
  return {
    symbol,
    pairAnalyzed: symbol,
    targetBotPair: symbol.replace(/USDT$|USDC$/, '') + 'USDC',
    previousState: prev,
    state,
    generatedAt: new Date().toISOString()
  };
}

describe('MonitoringService', () => {
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('does not notify on initial observation (no previous state)', async () => {
    const scan = { signals: [makeSignal('ABCUSDT', 'READY')], count: 1 };
    const signalizer: any = { scan: vi.fn().mockResolvedValue(scan) };

    // API returns transitionCreated false for initial
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ observation: {}, transitionCreated: false }) });

    const notifier = new DummyNotifier();
    const svc = new MonitoringService(signalizer, 'http://api', notifier as any);

    // run one cycle (start triggers immediate run)
    svc.start(9999); // large interval to avoid repeating
    // wait briefly for run to complete
    await new Promise((r) => setTimeout(r, 20));
    svc.stop();

    expect(notifier.events.length).toBe(0);
  });

  it('notifies when transitionCreated is true', async () => {
    const scan = { signals: [makeSignal('XYZUSDT', 'WATCH', 'READY')], count: 1 };
    const signalizer: any = { scan: vi.fn().mockResolvedValue(scan) };

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ observation: {}, transitionCreated: true, transition: { fromState: 'READY', toState: 'WATCH' } }) });

    const notifier = new DummyNotifier();
    const svc = new MonitoringService(signalizer, 'http://api', notifier as any);
    svc.start(9999);
    await new Promise((r) => setTimeout(r, 20));
    svc.stop();

    expect(notifier.events.length).toBe(1);
    expect(notifier.events[0].symbol).toBe('XYZUSDT');
    expect(notifier.events[0].fromState).toBe('READY');
    expect(notifier.events[0].toState).toBe('WATCH');
  });

  it('does not duplicate notifications for repeated same state', async () => {
    // first run: READY with previous READY -> no transition
    const states = [
      { signals: [makeSignal('REPUSDT', 'READY', 'READY')] },
      { signals: [makeSignal('REPUSDT', 'READY', 'READY')] }
    ];

    const signalizer: any = { scan: vi.fn().mockImplementation(() => Promise.resolve(states.shift() || { signals: [] })) };

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ observation: {}, transitionCreated: false }) });

    const notifier = new DummyNotifier();
    const svc = new MonitoringService(signalizer, 'http://api', notifier as any);
    svc.start(9999);
    await new Promise((r) => setTimeout(r, 40));
    svc.stop();

    expect(notifier.events.length).toBe(0);
  });

  it('skips processing when scan is skipped', async () => {
    const scan = { signals: [], skipped: true };
    const signalizer: any = { scan: vi.fn().mockResolvedValue(scan) };

    const fetchSpy = vi.fn();
    (globalThis as any).fetch = fetchSpy;

    const notifier = new DummyNotifier();
    const svc = new MonitoringService(signalizer, 'http://api', notifier as any);
    svc.start(9999);
    await new Promise((r) => setTimeout(r, 20));
    svc.stop();

    // persist should not be called when scan skipped
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('persistence failure prevents notification', async () => {
    const scan = { signals: [makeSignal('FAILUSDT', 'WATCH', 'READY')] };
    const signalizer: any = { scan: vi.fn().mockResolvedValue(scan) };

    // persistObservation fails (HTTP error)
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'db down' });

    const notifier = new DummyNotifier();
    const svc = new MonitoringService(signalizer, 'http://api', notifier as any);
    svc.start(9999);
    await new Promise((r) => setTimeout(r, 20));
    svc.stop();

    expect(notifier.events.length).toBe(0);
  });

  it('notification failure does not stop processing next signals', async () => {
    // first signal => persist ok, but notifier throws
    // second signal => persist ok, notifier succeeds
    const signals = [makeSignal('A1USDT', 'WATCH', 'READY'), makeSignal('A2USDT', 'WATCH', 'READY')];
    const signalizer: any = { scan: vi.fn().mockResolvedValue({ signals }) };

    const fetchSeq = [
      { ok: true, json: async () => ({ observation: {}, transitionCreated: true, transition: { id: 't1', fromState: 'READY', toState: 'WATCH' } }) },
      { ok: true, json: async () => ({ observation: {}, transitionCreated: true, transition: { id: 't2', fromState: 'READY', toState: 'WATCH' } }) }
    ];

    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(fetchSeq[call++]));

    class FailNotifier extends DummyNotifier {
      async notify(event: any) {
        if (event.symbol === 'A1USDT') throw new Error('notify fail');
        super.notify(event);
      }
    }

    const notifier = new FailNotifier();
    const svc = new MonitoringService(signalizer, 'http://api', notifier as any);
    svc.start(9999);
    await new Promise((r) => setTimeout(r, 40));
    svc.stop();

    // despite first notification failing, second succeeded and was recorded
    expect(notifier.events.length).toBe(1);
    expect(notifier.events[0].symbol).toBe('A2USDT');
  });
});
