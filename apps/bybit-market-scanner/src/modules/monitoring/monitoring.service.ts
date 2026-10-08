import type { SignalizerService } from '../signalizer/signalizer.service.js';
import { ConsoleNotifier } from './console.notifier.js';
import { SignalHistoryClient } from './signal-history.client.js';
import type { SignalizerNotifier } from './notifier.interface.js';

export class MonitoringService {
  private readonly notifier: SignalizerNotifier;
  private timer: NodeJS.Timeout | null = null;

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
            if (persisted?.transitionCreated) {
              const event = {
                symbol: sig.symbol,
                fromState: persisted.transition?.fromState ?? null,
                toState: persisted.transition?.toState ?? sig.state,
                observation: persisted.observation,
                transition: persisted.transition
              };
              await this.notifier.notify(event as any);
            }
          } catch (err) {
            // log and continue
            // eslint-disable-next-line no-console
            console.error('Failed to persist/notify for', sig.symbol, err instanceof Error ? err.message : err);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Monitoring run failed', err instanceof Error ? err.stack : err);
      }
    };

    // run immediately then schedule
    run().catch(() => {});
    this.timer = setInterval(() => run().catch(() => {}), intervalMinutes * 60 * 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
