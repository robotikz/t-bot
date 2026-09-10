export interface AppConfig {
  NODE_ENV: string;
  PORT: number;
  API_PREFIX: string;
  DATABASE_URL: string;
  LOG_LEVEL: string;
  FRONTEND_URL: string;
}

export const configuration = (): AppConfig => ({
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number.parseInt(process.env.PORT ?? '3000', 10),
  API_PREFIX: process.env.API_PREFIX ?? 'api',
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/trading_platform',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'log',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:4200',
});
