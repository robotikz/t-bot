/* global AbortSignal */
export class SignalHistoryClient {
  constructor(private readonly baseUrl: string) {}

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  async persistObservation(observation: unknown, timeoutMs = 10000): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(this.url('/api/signalizer/observations'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(observation),
        signal: controller.signal as AbortSignal
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to persist observation: ${res.status} ${text}`);
      }

      return res.json();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('aborted') || msg.includes('AbortError')) throw new Error('persist timeout');
      throw err;
    } finally {
      clearTimeout(id);
    }
  }
}
