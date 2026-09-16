import { IsOptional, IsBoolean, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { ExchangeName } from '../../../common/enums.js';

export class ListExchangesDto {
  @IsOptional()
  @IsIn(Object.values(ExchangeName))
  name?: ExchangeName;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  enabled?: boolean;
}
