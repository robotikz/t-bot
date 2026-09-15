import { IsOptional, IsInt, Min, IsString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { Timeframe } from '../../../common/enums.js';

export class ListCandlesDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsIn(Object.values(Timeframe))
  timeframe?: Timeframe;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  limit?: number;
}
