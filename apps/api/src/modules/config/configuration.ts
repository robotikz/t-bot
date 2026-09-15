export interface AppConfig {
  NODE_ENV: string;
  PORT: number;
  API_PREFIX: string;
  DATABASE_URL: string;
  LOG_LEVEL: string;
  FRONTEND_URL: string;
  BYBIT_ENABLED: string;
  BYBIT_API_KEY: string;
  BYBIT_API_SECRET: string;
  TRADING212_ENABLED: string;
  TRADING212_API_KEY: string;
  TRADING212_API_SECRET: string;
}

export const configuration = (): AppConfig => ({
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number.parseInt(process.env.PORT ?? '3000', 10),
  API_PREFIX: process.env.API_PREFIX ?? 'api',
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/trading_platform',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'log',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:4200',
  BYBIT_ENABLED: process.env.BYBIT_ENABLED ?? 'false',
  BYBIT_API_KEY: process.env.BYBIT_API_KEY ?? '',
  BYBIT_API_SECRET: process.env.BYBIT_API_SECRET ?? '',
  TRADING212_ENABLED: process.env.TRADING212_ENABLED ?? 'false',
  TRADING212_API_KEY: process.env.TRADING212_API_KEY ?? '',
  TRADING212_API_SECRET: process.env.TRADING212_API_SECRET ?? '',
});
