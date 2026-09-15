import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListStrategiesDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  enabled?: boolean;
}
