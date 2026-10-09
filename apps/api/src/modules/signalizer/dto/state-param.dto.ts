import { IsString, Matches } from 'class-validator';

// Simple symbol rule: uppercase letters/numbers and optional USDT/USDC suffix
const SYMBOL_REGEX = /^[A-Z0-9]+(?:USDT|USDC)?$/;

export class StateParamDto {
  @IsString()
  @Matches(SYMBOL_REGEX, { message: 'Invalid symbol format' })
  symbol!: string;
}
