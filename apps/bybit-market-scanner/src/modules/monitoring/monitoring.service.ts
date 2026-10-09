import type { SignalizerService } from '../signalizer/signalizer.service.js';
import { ConsoleNotifier } from './console.notifier.js';
import { SignalHistoryClient } from './signal-history.client.js';
import type { SignalizerNotifier, SignalizerEvent } from './notifier.interface.js';

export class MonitoringService {
  private readonly notifier: SignalizerNotifier;
  private timer: ReturnType<typeof globalThis.setInterval> | null = null;
  // keep in-memory set of already-notified transition ids to avoid duplicates
  private notifiedTransitions = new Set<string>();

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

        // If the scan was skipped (another scan in progress), do not process stateStore signals.
        if ((result as unknown as { skipped?: boolean }).skipped) {
          return;
        }

        for (const sig of result.signals) {
          try {
            // persist with a bounded timeout to avoid hanging the monitoring loop
            const persisted = await client.persistObservation(sig, 10_000);
            // persisted expected shape: { observation, transitionCreated, transition }
            const persistedRec = persisted as Record<string, unknown>;
            const transitionCreated = Boolean(persistedRec['transitionCreated']);
            if (transitionCreated) {
              const transitionRec = persistedRec['transition'] as Record<string, unknown> | undefined;
              const observationRec = persistedRec['observation'] as Record<string, unknown> | undefined;
              const symbol = String(sig.symbol ?? '');
              const fromState = transitionRec && typeof transitionRec['fromState'] === 'string' ? (transitionRec['fromState'] as string) : null;
              const toState = transitionRec && typeof transitionRec['toState'] === 'string' ? (transitionRec['toState'] as string) : String(sig.state ?? '');

              // protect against duplicate notifications for the same persisted transition
              const transitionId = transitionRec && (transitionRec['id'] ?? transitionRec['observationId']) ? String(transitionRec['id'] ?? transitionRec['observationId']) : null;
              if (transitionId && this.notifiedTransitions.has(transitionId)) {
                continue;
              }

              const event: SignalizerEvent = {
                symbol,
                fromState,
                toState,
                observation: observationRec ?? {},
                transition: transitionRec ?? {}
              };

              try {
                // bound notifier time to avoid a stuck notifier blocking the loop
                const notifyPromise = this.notifier.notify(event);
                const timeoutMs = 5_000;
                await Promise.race([
                  notifyPromise,
                  new Promise((_, rej) => setTimeout(() => rej(new Error('notify timeout')), timeoutMs))
                ]);

                if (transitionId) this.notifiedTransitions.add(transitionId);
              } catch (err) {
                // If notification fails, log and continue; persisted history remains in backend.
                console.error('Notification failed for', String(sig.symbol ?? ''), err instanceof Error ? err.message : err);
              }
            }
          } catch (err) {
            // log and continue; ensure one symbol's failure does not crash whole cycle
            console.error('Failed to persist/notify for', String(sig.symbol ?? ''), err instanceof Error ? err.message : err);
          }
        }
      } catch (err) {
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
