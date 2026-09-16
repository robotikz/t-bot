import { IsIn, IsString } from 'class-validator';
import { MARKET_DATA_PUBLIC_TIMEFRAMES, type MarketDataPublicTimeframe } from '../../market-data/market-data.constants.js';

export class EvaluateStrategyDto {
  @IsString()
  broker!: string;

  @IsString()
  symbol!: string;

  @IsIn(MARKET_DATA_PUBLIC_TIMEFRAMES)
  timeframe!: MarketDataPublicTimeframe;
}
