import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { MARKET_DATA_PUBLIC_TIMEFRAMES, type MarketDataPublicTimeframe } from '../../market-data/market-data.constants.js';

export class RunBacktestDto {
  @IsString()
  broker!: string;

  @IsString()
  symbol!: string;

  @IsIn(MARKET_DATA_PUBLIC_TIMEFRAMES)
  timeframe!: MarketDataPublicTimeframe;

  @IsString()
  strategyId!: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  initialCapital!: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  @Max(1)
  feeRate!: number;

  @IsOptional()
  @IsObject()
  strategyParameters?: Record<string, number | string | boolean | null | undefined>;
}
