import { Account, Balance, Position } from './types.js';

export interface AccountProvider {
  getAccount(): Promise<Account>;
  getBalances(): Promise<Balance[]>;
  getPositions(): Promise<Position[]>;
}
