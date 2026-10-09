import { IsIn, IsInt, IsOptional, IsPositive, IsString, Max, Min, ValidateIf, IsISO8601 } from 'class-validator';

const ALLOWED_STATES = ['WATCH', 'SETUP_FORMING', 'READY', 'INVALIDATED', 'NO_TRADE'] as const;

export class HistoryQueryDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_STATES as any)
  state?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;
}
