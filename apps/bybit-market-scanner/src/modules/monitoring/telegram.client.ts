export interface TelegramSendResult {
  ok: boolean;
  result?: unknown;
  description?: string;
}

export function escapeHtml(s: unknown): string {
  const str = String(s ?? '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class TelegramClient {
  constructor(private readonly token: string, private readonly timeoutMs = 5000) {}

  private apiUrl() {
    return `https://api.telegram.org/bot${this.token}`;
  }

  private async fetchWithTimeout(input: string, init: Record<string, unknown>) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      type FetchFn = (input: unknown, init?: unknown) => Promise<unknown>;
      const gf = (globalThis as unknown as { fetch?: FetchFn }).fetch;
      if (!gf) throw new Error('fetch not available');
      const mergedInit = { ...(init ?? {}), signal: controller.signal } as unknown;
      const resRaw = await gf(input, mergedInit);
      return resRaw as { ok?: boolean; status?: number; text?: () => Promise<string>; json?: () => Promise<unknown> };
    } finally {
      clearTimeout(id);
    }
  }

  async sendMessage(chatId: string | number, text: string, parseMode = 'HTML'): Promise<TelegramSendResult> {
    const url = `${this.apiUrl()}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: escapeHtml(text),
      parse_mode: parseMode,
      disable_web_page_preview: true
    };

    try {
      const resObj = (await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })) as { ok?: boolean; status?: number; text?: () => Promise<string>; json?: () => Promise<unknown> };

      if (!resObj) return { ok: false, description: 'No response from fetch' };

      if (!resObj.ok) {
        const textResp = await (resObj.text ? resObj.text() : Promise.resolve('')).catch(() => '');
        return { ok: false, description: `HTTP ${resObj.status ?? '??'} ${textResp}` };
      }

      const json = await (resObj.json ? resObj.json() : Promise.resolve(null)).catch(() => null);
      // Telegram API returns { ok: boolean, result: ... }
      const parsed = json as Record<string, unknown> | null;
      if (parsed && typeof parsed.ok === 'boolean' && parsed.ok === false) {
        return { ok: false, description: String(parsed['description'] ?? 'telegram api returned ok: false') };
      }

      return { ok: true, result: json };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, description: msg.includes('aborted') || msg.includes('AbortError') ? 'timeout' : msg };
    }
  }
}
