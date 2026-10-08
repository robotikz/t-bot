import type { SignalizerNotifier, SignalizerEvent } from './notifier.interface.js';
import { TelegramClient } from './telegram.client.js';

function escape(s: unknown): string {
  return String(s ?? '').toString();
}

function formatSetup(observation: Record<string, unknown>): string | null {
  const setup = observation['setup'] as Record<string, unknown> | undefined;
  if (!setup) return null;
  const entryLow = setup['entryLow'];
  const entryHigh = setup['entryHigh'];
  const gridLow = setup['gridLow'];
  const gridHigh = setup['gridHigh'];
  const gridCount = setup['gridCount'];
  const stopLoss = setup['stopLoss'];
  const takeProfit = setup['takeProfit'];
  const investment = setup['investment'];
  const risk = setup['risk'];

  let out = '';
  out += `<b>Entry</b>: ${escape(entryLow)}–${escape(entryHigh)}\n`;
  out += `<b>Grid</b>: ${escape(gridLow)}–${escape(gridHigh)}\n`;
  out += `<b>Grids</b>: ${escape(gridCount)}\n`;
  out += `<b>SL</b>: ${escape(stopLoss)}\n`;
  out += `<b>TP</b>: ${escape(takeProfit)}\n`;
  out += `<b>Investment</b>: ${escape(investment)} USDC\n`;
  out += `<b>Risk</b>: ${escape(risk)}\n`;

  return out;
}

export class TelegramNotifier implements SignalizerNotifier {
  private client: TelegramClient | null = null;
  private chatId: string | number | null = null;

  constructor(private readonly opts: { enabled?: boolean; token?: string; chatId?: string | number; timeoutMs?: number } = {}) {
    if (opts.enabled && opts.token && opts.chatId) {
      this.client = new TelegramClient(opts.token, opts.timeoutMs ?? 5000);
      this.chatId = opts.chatId;
    }
  }

  private async safeSend(text: string) {
    if (!this.client || !this.chatId) return;
    try {
      const res = await this.client.sendMessage(this.chatId, text, 'HTML');
      if (!res.ok) {
        console.error('Telegram send failed', res.description ?? 'unknown');
      }
    } catch (err) {
      console.error('Telegram send error', err instanceof Error ? err.message : err);
    }
  }

  async notify(event: SignalizerEvent): Promise<void> {
    if (!this.client) return;

    const prev = event.fromState ?? 'INITIAL_OBSERVATION';
    const header = event.toState === 'READY' ? '🟢 GRID READY' : event.toState === 'WATCH' ? '🟡 GRID WATCH' : '🔴 GRID INVALIDATED';

    const obs = event.observation ?? {};
    const setupBlock = formatSetup(obs as Record<string, unknown>);
    const confidence = (obs as Record<string, unknown>)['confidence'] ?? (setupBlock ? (obs as Record<string, unknown>)['confidence'] ?? 0 : 0);
    const pairValidation = (obs as Record<string, unknown>)['pairValidation'] as Record<string, unknown> | undefined;
    const usdcReady = pairValidation && String(pairValidation['status']) === 'USDC_READY';
    const reasons = (obs as Record<string, unknown>)['reasons'] as string[] | undefined;

    let text = '';
    text += `<b>${header}</b>\n\n`;
    text += `<b>${escape(event.symbol)}</b>\n\n`;

    if (setupBlock && event.toState === 'READY') {
      text += setupBlock + '\n';
      text += `<b>Confidence</b>: ${escape(confidence)}%\n`;
      const market = (obs as Record<string, unknown>)['market'] as Record<string, unknown> | undefined;
      const tf4 = market && 'timeframe4h' in market ? String((market as Record<string, unknown>)['timeframe4h'] ?? '') : '';
      const tf1 = market && 'timeframe1h' in market ? String((market as Record<string, unknown>)['timeframe1h'] ?? '') : '';
      const tf15 = market && 'timeframe15m' in market ? String((market as Record<string, unknown>)['timeframe15m'] ?? '') : '';
      text += `<b>4H</b>: ${escape(tf4)}\n`;
      text += `<b>1H</b>: ${escape(tf1)}\n`;
      text += `<b>15M</b>: ${escape(tf15)}\n`;
      text += `<b>USDC</b>: ${usdcReady ? '✅' : '❌'}\n`;
    } else if (event.fromState && event.toState) {
      text += `<b>Previous state</b>: ${escape(prev)}\n`;
      text += `<b>Current state</b>: ${escape(event.toState)}\n`;
      if (reasons && reasons.length > 0) text += `\n<b>Reason</b>: ${escape((reasons || []).join('; '))}\n`;
    } else {
      // generic fallback
      text += `<b>Previous</b>: ${escape(prev)}\n`;
      text += `<b>Current</b>: ${escape(event.toState)}\n`;
      if (reasons && reasons.length > 0) text += `\n<b>Reason</b>: ${escape((reasons || []).join('; '))}\n`;
    }

    text += `\n<em>${escape((event.observation as Record<string, unknown>)['generatedAt'] ?? new Date().toISOString())}</em>`;

    await this.safeSend(text);
  }
}
