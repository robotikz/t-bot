# Bybit Market Scanner (MVP Backend)

Fastify + TypeScript backend for scanning Bybit spot USDC pairs and ranking grid-trading candidates.

## Features

- Fastify HTTP API (no DB, no NestJS)
- Bybit v5 public market endpoints
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
- `GET /api/markets?quoteCoin=USDC`
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
