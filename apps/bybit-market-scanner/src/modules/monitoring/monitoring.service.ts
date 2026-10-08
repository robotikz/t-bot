import type { SignalizerService } from '../signalizer/signalizer.service.js';
import { ConsoleNotifier } from './console.notifier.js';
import { SignalHistoryClient } from './signal-history.client.js';
import type { SignalizerNotifier, SignalizerEvent } from './notifier.interface.js';

export class MonitoringService {
  private readonly notifier: SignalizerNotifier;
  private timer: ReturnType<typeof globalThis.setInterval> | null = null;

  constructor(
    private readonly signalizer: SignalizerService,
    private readonly apiUrl: string,
    notifier?: SignalizerNotifier
  ) {
    this.notifier = notifier ?? new ConsoleNotifier();
  }

  start(intervalMinutes = 15) {
    if (this.timer) return;
    const client = new SignalHistoryClient(this.apiUrl);
    const run = async () => {
      try {
        const result = await this.signalizer.scan();
        for (const sig of result.signals) {
          try {
            const persisted = await client.persistObservation(sig);
            // persisted expected shape: { observation, transitionCreated, transition }
            const persistedRec = persisted as Record<string, unknown>;
            const transitionCreated = Boolean(persistedRec['transitionCreated']);
            if (transitionCreated) {
              const transitionRec = persistedRec['transition'] as Record<string, unknown> | undefined;
              const observationRec = persistedRec['observation'] as Record<string, unknown> | undefined;
              const symbol = String(sig.symbol ?? '');
              const fromState = transitionRec && typeof transitionRec['fromState'] === 'string' ? (transitionRec['fromState'] as string) : null;
              const toState = transitionRec && typeof transitionRec['toState'] === 'string' ? (transitionRec['toState'] as string) : String(sig.state ?? '');

              const event: SignalizerEvent = {
                symbol,
                fromState,
                toState,
                observation: observationRec ?? {},
                transition: transitionRec ?? {}
              };

              await this.notifier.notify(event);
            }
          } catch (err) {
            // log and continue
            // eslint-disable-next-line no-console
            console.error('Failed to persist/notify for', String(sig.symbol ?? ''), err instanceof Error ? err.message : err);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Monitoring run failed', err instanceof Error ? err.stack : err);
      }
    };

    // run immediately then schedule
    run().catch(() => {});
    this.timer = globalThis.setInterval(() => run().catch(() => {}), intervalMinutes * 60 * 1000);
  }

  stop() {
    if (this.timer) {
      globalThis.clearInterval(this.timer as ReturnType<typeof globalThis.setInterval>);
      this.timer = null;
    }
  }
}
