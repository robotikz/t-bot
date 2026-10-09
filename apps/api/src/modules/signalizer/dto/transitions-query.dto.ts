import { IsOptional, IsString, IsISO8601 } from 'class-validator';

export class TransitionsQueryDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
