import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

export type AppConfigKey =
  | 'NODE_ENV'
  | 'PORT'
  | 'API_PREFIX'
  | 'DATABASE_URL'
  | 'LOG_LEVEL'
  | 'FRONTEND_URL';

@Injectable()
export class ConfigService {
  constructor(private readonly configService: NestConfigService) {}

  getString(key: AppConfigKey, defaultValue = ''): string {
    return this.configService.get<string>(key, defaultValue) ?? defaultValue;
  }

  getNumber(key: 'PORT', defaultValue = 3000): number {
    const value = this.configService.get<string>(key, String(defaultValue));
    return Number(value ?? defaultValue);
  }
}
