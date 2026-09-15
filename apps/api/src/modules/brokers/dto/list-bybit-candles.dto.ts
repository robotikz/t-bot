import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const BYBIT_PUBLIC_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

export type BybitPublicTimeframe = (typeof BYBIT_PUBLIC_TIMEFRAMES)[number];

export class ListBybitCandlesDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsString()
  symbol!: string;

  @IsIn(BYBIT_PUBLIC_TIMEFRAMES)
  timeframe!: BybitPublicTimeframe;

  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
