import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MARKET_DATA_PUBLIC_TIMEFRAMES, type MarketDataPublicTimeframe } from '../market-data.constants.js';

export class ListMarketDataCandlesDto {
  @IsString()
  broker!: string;

  @IsString()
  symbol!: string;

  @IsIn(MARKET_DATA_PUBLIC_TIMEFRAMES)
  timeframe!: MarketDataPublicTimeframe;

  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}
