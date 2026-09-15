import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

export type AppConfigKey =
  | 'NODE_ENV'
  | 'PORT'
  | 'API_PREFIX'
  | 'DATABASE_URL'
  | 'LOG_LEVEL'
  | 'FRONTEND_URL'
  | 'BYBIT_ENABLED'
  | 'BYBIT_TESTNET'
  | 'BYBIT_BASE_URL'
  | 'BYBIT_TIMEOUT_MS'
  | 'BYBIT_API_KEY'
  | 'BYBIT_API_SECRET'
  | 'TRADING212_ENABLED'
  | 'TRADING212_API_KEY'
  | 'TRADING212_API_SECRET';

@Injectable()
export class ConfigService {
  constructor(private readonly configService: NestConfigService) {}

  getString(key: AppConfigKey, defaultValue = ''): string {
    return this.configService.get<string>(key, defaultValue) ?? defaultValue;
  }

  getNumber(key: 'PORT' | 'BYBIT_TIMEOUT_MS', defaultValue = 3000): number {
    const value = this.configService.get<string>(key, String(defaultValue));
    return Number(value ?? defaultValue);
  }

  getBoolean(key: AppConfigKey, defaultValue = false): boolean {
    return (this.configService.get<string>(key, String(defaultValue)) ?? String(defaultValue)).toLowerCase() === 'true';
  }
}
