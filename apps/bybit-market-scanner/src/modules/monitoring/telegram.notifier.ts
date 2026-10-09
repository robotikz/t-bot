import type { SignalizerNotifier, SignalizerEvent } from './notifier.interface.js';
import { TelegramClient } from './telegram.client.js';

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
  out += `<b>Entry</b>: ${String(entryLow)}–${String(entryHigh)}\n`;
  out += `<b>Grid</b>: ${String(gridLow)}–${String(gridHigh)}\n`;
  out += `<b>Grids</b>: ${String(gridCount)}\n`;
  out += `<b>SL</b>: ${String(stopLoss)}\n`;
  out += `<b>TP</b>: ${String(takeProfit)}\n`;
  out += `<b>Investment</b>: ${String(investment)} USDC\n`;
  out += `<b>Risk</b>: ${String(risk)}\n`;

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
        // Avoid logging secrets (token/chatId). Log only a short description.
        console.error('Telegram send failed:', String(res.description ?? 'unknown'));
      }
    } catch (err) {
      console.error('Telegram send error:', err instanceof Error ? err.message : String(err));
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
    text += `<b>${String(event.symbol ?? '')}</b>\n\n`;

    if (setupBlock && event.toState === 'READY') {
      text += setupBlock + '\n';
      text += `<b>Confidence</b>: ${String(confidence)}%\n`;
      const market = (obs as Record<string, unknown>)['market'] as Record<string, unknown> | undefined;
      const tf4 = market && 'timeframe4h' in market ? String((market as Record<string, unknown>)['timeframe4h'] ?? '') : '';
      const tf1 = market && 'timeframe1h' in market ? String((market as Record<string, unknown>)['timeframe1h'] ?? '') : '';
      const tf15 = market && 'timeframe15m' in market ? String((market as Record<string, unknown>)['timeframe15m'] ?? '') : '';
      text += `<b>4H</b>: ${String(tf4)}\n`;
      text += `<b>1H</b>: ${String(tf1)}\n`;
      text += `<b>15M</b>: ${String(tf15)}\n`;
      text += `<b>USDC</b>: ${usdcReady ? '✅' : '❌'}\n`;
    } else if (event.fromState && event.toState) {
      text += `<b>Previous state</b>: ${String(prev)}\n`;
      text += `<b>Current state</b>: ${String(event.toState)}\n`;
      if (reasons && reasons.length > 0) text += `\n<b>Reason</b>: ${(reasons || []).join('; ')}\n`;
    } else {
      // generic fallback
      text += `<b>Previous</b>: ${String(prev)}\n`;
      text += `<b>Current</b>: ${String(event.toState)}\n`;
      if (reasons && reasons.length > 0) text += `\n<b>Reason</b>: ${(reasons || []).join('; ')}\n`;
    }

    text += `\n<em>${String((event.observation as Record<string, unknown>)['generatedAt'] ?? new Date().toISOString())}</em>`;

    await this.safeSend(text);
  }
}
