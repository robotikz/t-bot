# Bybit Market Scanner (MVP Backend)

Fastify + TypeScript backend for scanning Bybit spot markets by quote coin and ranking grid-trading candidates.

## Features

- Fastify HTTP API (no DB, no NestJS)
- Bybit v5 public market endpoints
- Configurable Bybit API base URL (`BYBIT_API_BASE_URL`, defaults to `https://api.bybit.eu`)
- Market data normalization and validation
- Analysis engine:
  - range
  - volatility
  - trend (EMA20/EMA50)
  - support/resistance (swing clustering)
- Scanner engine combining 15m + 1h analysis
- Unit + integration tests with mocked Bybit responses

## API

- `GET /api/health`
- `GET /api/markets?quoteCoin=USDT`
- `GET /api/scanner?timeframe=15m|1h&secondaryTimeframe=15m|1h&limit=100..200&minTurnover=<number>`

## Setup

1. Install dependencies
   - `npm install`
2. Optional environment setup
   - copy `.env.example` to `.env` and adjust values
3. Start dev server
   - `npm run dev`

## Scripts

- `npm run dev` – run with watch mode
- `npm run build` – compile TypeScript
- `npm run start` – run compiled app
- `npm run test` – run test suite
- `npm run lint` – run ESLint

## Notes

- Scanner uses only Bybit public endpoints.
- Request retries and short in-memory caching are enabled in the Bybit client.
- Market/ticker/candle cache TTL and scanner thresholds are configurable via environment variables.

## Telegram Notifications

- Enable with `TELEGRAM_ENABLED=true` and set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in your `.env`.
- Messages are sent only for state transitions (e.g., `READY -> WATCH`, `WATCH -> READY`, `READY -> NO_TRADE`).
- Telegram is optional; when disabled monitoring continues and `ConsoleNotifier` remains the fallback.
- The notifier uses the Telegram Bot API `sendMessage` endpoint and respects `TELEGRAM_TIMEOUT_MS`.
