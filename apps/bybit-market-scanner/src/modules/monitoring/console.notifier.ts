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
    if (event.observation?.setup) {
      const s = event.observation.setup;
      console.log('Entry:', `${s.entryLow}–${s.entryHigh}`);
      console.log('Grid:', `${s.gridLow}–${s.gridHigh}`);
      console.log('Grids:', s.gridCount);
      console.log('SL:', s.stopLoss);
      console.log('TP:', s.takeProfit);
      console.log('Investment:', s.investment);
      console.log('Risk:', s.risk);
      console.log('Confidence:', event.observation.confidence ?? s.confidence ?? 0);
    }
    if (event.observation?.pairValidation) {
      console.log('USDC:', event.observation.pairValidation.status === 'USDC_READY' ? '✅' : '❌');
    }
    if (event.observation?.reasons) console.log('Reason:', (event.observation.reasons || []).join('; '));
    console.log('---');
  }
}
