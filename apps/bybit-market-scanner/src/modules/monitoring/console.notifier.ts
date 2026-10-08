import { SignalizerEvent, SignalizerNotifier } from './notifier.interface.js';

export class ConsoleNotifier implements SignalizerNotifier {
  async notify(event: SignalizerEvent): Promise<void> {
    const header = event.toState === 'READY' ? '🟢 GRID READY' : event.toState === 'WATCH' ? '🟡 GRID WATCH' : '🔴 GRID INVALIDATED';
    const prev = event.fromState ?? 'INITIAL_OBSERVATION';
    console.log('---');
    console.log(header);
    console.log(event.symbol);
    console.log('Previous state:', prev);
    console.log('Current state:', event.toState);
    const obs = event.observation ?? {};
    const setup = (obs as Record<string, unknown>)['setup'] as Record<string, unknown> | undefined;
    if (setup) {
      const entryLow = Number(setup['entryLow']);
      const entryHigh = Number(setup['entryHigh']);
      const gridLow = Number(setup['gridLow']);
      const gridHigh = Number(setup['gridHigh']);
      const gridCount = Number(setup['gridCount']);
      const stopLoss = Number(setup['stopLoss']);
      const takeProfit = Number(setup['takeProfit']);
      const investment = Number(setup['investment']);
      const risk = String(setup['risk'] ?? '');
      const confidence = Number((obs as Record<string, unknown>)['confidence'] ?? setup['confidence'] ?? 0);

      console.log('Entry:', `${entryLow}–${entryHigh}`);
      console.log('Grid:', `${gridLow}–${gridHigh}`);
      console.log('Grids:', gridCount);
      console.log('SL:', stopLoss);
      console.log('TP:', takeProfit);
      console.log('Investment:', investment);
      console.log('Risk:', risk);
      console.log('Confidence:', confidence);
    }
    const pairValidation = (obs as Record<string, unknown>)['pairValidation'] as Record<string, unknown> | undefined;
    if (pairValidation) {
      console.log('USDC:', String(pairValidation['status']) === 'USDC_READY' ? '✅' : '❌');
    }
    const reasons = (obs as Record<string, unknown>)['reasons'] as string[] | undefined;
    if (reasons) console.log('Reason:', (reasons || []).join('; '));
    console.log('---');
  }
}
