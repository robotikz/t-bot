export class SignalHistoryClient {
  constructor(private readonly baseUrl: string) {}

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  async persistObservation(observation: any) {
    const res = await fetch(this.url('/api/signalizer/observations'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(observation)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to persist observation: ${res.status} ${text}`);
    }

    return res.json();
  }
}
