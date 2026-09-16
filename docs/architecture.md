# Architecture

## System overview

This repository is a small monorepo for a trading platform MVP. It separates the platform into three layers:

1. `apps/api` — NestJS backend
2. `apps/web` — Angular frontend
3. `packages/shared` — future shared logic/types

The system is designed to support local development with PostgreSQL and a clean path toward future market-data and trading workflows.

## Backend architecture

### Framework and runtime

- NestJS 12
- TypeScript
- Node.js 22
- Prisma ORM
- PostgreSQL 17

### Current modules

- `ConfigModule`: loads environment variables and exposes application configuration
- `PrismaModule`: provides a shared Prisma client service
- `HealthModule`: exposes `GET /api/health` for health-check and startup validation
- `BrokersModule`: exposes broker abstraction metadata and manages broker adapter registration
- `BybitBrokerAdapter`: read-only public market-data adapter for Bybit spot instruments and klines
- `Trading212BrokerAdapter`: read-only account adapter for Trading212 Invest and Stocks ISA accounts
- `MarketDataModule`: broker-agnostic candle fetch/ingest/read orchestration
- `StrategiesModule`: broker-agnostic strategy registry and signal evaluation endpoints
- `BacktestsModule`: broker-agnostic backtesting orchestration and deterministic simulation over normalized candles

### Key files

- `apps/api/src/app.module.ts`: root application module
- `apps/api/src/main.ts`: bootstrap entrypoint
- `apps/api/src/modules/config/config.service.ts`: config access
- `apps/api/src/prisma/prisma.service.ts`: Prisma lifecycle management
- `apps/api/prisma/schema.prisma`: database schema

### API conventions

- Global prefix is `/api`
- Health endpoint is `GET /api/health`
- Broker endpoints are read-only in Phase 4+: `GET /api/brokers`, `GET /api/brokers/:id`, `GET /api/brokers/:id/capabilities`
- Strategy endpoints are read-only in Phase 8: `GET /api/strategies`, `GET /api/strategies/:strategyId/evaluate`
- CORS is enabled for `http://localhost:4200` during local development

## Broker abstraction layer

The trading platform now separates strategy logic from broker-specific implementations through a capability-oriented broker layer:

Strategy
	↓
BrokerManager
	↓
BrokerAdapter
	↓
Concrete Broker Adapter
	↓
External Broker API

### Why capability-based interfaces

Different brokers expose different APIs and feature sets. A single large adapter interface would force incompatible implementations and leak broker-specific assumptions into strategy code.

To avoid that, the broker layer is split into focused capabilities:

- `MarketDataProvider`
- `AccountProvider`
- `TradingProvider`

A broker adapter declares supported capabilities through `BrokerCapability` and only exposes the capability providers it actually supports. This keeps the Strategy Engine broker-agnostic and preserves a clean dependency direction:

Domain
	↓
Application
	↓
Infrastructure

### Phase 4 scope

- The broker layer remains capability-driven and the Bybit adapter only advertises `MARKET_DATA`
- Bybit market-data requests are handled through a dedicated HTTP client and mapper layer under `apps/api/src/modules/brokers/infrastructure/bybit/`
- The adapter uses Bybit v5 public REST endpoints for spot instruments and klines; no private account or trading endpoints are used in this phase
- Public Bybit market-data endpoints work without API credentials; credentials remain optional and unused by this phase
- Candles are normalized into the existing internal `Candle` model and returned in chronological order (`oldest → newest`)
- No database changes were required because market data is fetched directly from Bybit and not persisted by the adapter

### Phase 6 scope

- The Trading212 adapter is also read-only, but it intentionally advertises only `ACCOUNT`
- Trading212 is integrated through a dedicated HTTP client under `apps/api/src/modules/brokers/infrastructure/trading212/`
- The official Trading212 Public API currently supports HTTP Basic authentication, account summary, positions, instrument metadata, orders, and historical account events
- Phase 6 uses only the endpoints that map cleanly into the current capability model: account summary and positions
- The adapter maps Trading212 account cash and portfolio values into the generic `Account`, `Balance`, and `Position` domain types
- Trading212 does not currently expose a Bybit-style candle or public market-data endpoint, so the adapter does not advertise `MARKET_DATA`
- Unsupported official capabilities such as order placement and order history remain outside Phase 6 because the current broker abstraction has no read-only history provider and the phase is explicitly read-only

### Phase 7 scope

- Added a unified `MarketDataModule` that sits between broker adapters and the candle store
- The market-data service is broker-agnostic and only depends on `BrokerManager`, `MarketDataProvider`, and the existing candle repository
- The engine separates `fetch` (broker read), `ingest` (validate + persist), and `read` (PostgreSQL query) operations
- Candle identity is canonicalized as `brokerId + symbol + timeframe + openTime`, backed by a database unique constraint to make ingestion idempotent
- Candle reads are ordered `oldest → newest` throughout the engine, matching the Bybit adapter’s normalized order
- Candle closure is computed from timestamps and the current time; incomplete candles remain distinguishable without pushing broker-specific state into the domain layer
- Historical loading uses small broker-backed pagination and enforces a safe maximum candle count via configuration
- Trading212 remains an `ACCOUNT`-only adapter and is intentionally excluded from market-data candle support

### Phase 8 scope

- Added a broker-agnostic strategy engine that evaluates normalized candle data and produces analytical signals
- Added a unified signal model with `BUY`, `SELL`, and `HOLD` types
- Added an indicator engine with internal EMA and RSI implementations
- Added first strategies:
  - EMA crossover (`ema-crossover`, default fast=9, slow=21)
  - RSI threshold strategy (`rsi`, default period=14, oversold=30, overbought=70)
- Added a strategy registry for list/lookup/evaluate without HTTP coupling
- Added an application-level strategy evaluation service that coordinates:
  - market-data loading through `MarketDataService`
  - strategy selection through `StrategyRegistry`
  - strategy execution on normalized `Candle[]`
- Strategy evaluation explicitly filters for closed candles and does not assume the last array element is closed
- Signals are not persisted in Phase 8 and are returned as read/evaluation results only
- No order execution, live trading, paper trading, scheduling, or backtesting is included in this phase

Strategy architecture:

PostgreSQL
	↓
Market Data Engine
	↓
Candle[]
	↓
Indicator Engine
	↓
EMA / RSI
	↓
Strategy Engine
	↓
Signal
	↓
REST API

### Phase 9 scope

- Added a broker-agnostic backtesting engine that reuses the Phase 8 strategy abstraction without changing strategy behavior for replay mode
- Added a `BacktestsModule` with:
	- `BacktestService`
	- in-memory `BacktestEngine`
	- `POST /api/backtests`
- Added deterministic backtest domain models for:
	- `BacktestConfig`
	- `SimulatedPosition`
	- `BacktestTrade`
	- `EquityPoint`
	- `BacktestMetrics`
	- `BacktestResult`
- Added date-range historical loading to the market-data engine so backtests still flow through:

BacktestController
	↓
BacktestService
	↓
Market Data Engine
	↓
BrokerManager
	↓
BrokerAdapter
	↓
Candle[]
	↓
StrategyRegistry
	↓
BacktestEngine
	↓
BacktestResult

- The backtest execution model is deliberately simple and deterministic:
	- long-only
	- single open position at a time
	- signal generated on candle close
	- execution at next candle open
	- repeated `BUY` while long is ignored
	- repeated `SELL` while flat is ignored
	- open positions at the end of the run are force-closed at the final candle close
- The simulator applies fees on both entry and exit notionals
- Equity is recorded after every processed candle using candle-close mark-to-market valuation
- Metrics currently include final capital, profit, return, trade counts, win rate, average trade values, gross profit/loss, and max drawdown
- Backtest runs are not persisted in Phase 9; they remain request/response computations
- No paper trading, live execution, leverage, short selling, stop-loss, take-profit, or optimization is included in this phase

### Bybit API assumptions

- Base URLs: `https://api.bybit.com` for mainnet and `https://api-testnet.bybit.com` for testnet
- Instruments endpoint: `GET /v5/market/instruments-info?category=spot`
- Candles endpoint: `GET /v5/market/kline?category=spot&symbol=...&interval=...`
- Bybit REST responses use the common envelope `{ retCode, retMsg, result, retExtInfo, time }`
- Spot instruments do not use pagination; the adapter requests the spot category directly
- Kline responses are returned newest-first by Bybit and are re-sorted into chronological order in the adapter
- When the market-data engine reloads historical candles, it pages through the adapter with bounded requests instead of requesting an unlimited history window

### Trading212 API assumptions

- Base URLs: `https://demo.trading212.com/api/v0/` for paper trading and `https://live.trading212.com/api/v0/` for live trading
- Authentication: HTTP Basic auth using API key as username and API secret as password
- Required header: `Authorization: Basic <base64(api_key:api_secret)>`
- Supported endpoints used in Phase 6: `GET /api/v0/equity/account/summary` and `GET /api/v0/equity/positions`
- Account summary exposes cash, primary currency, and investment totals; positions expose quantity, average price, current price, and wallet impact
- The API includes per-endpoint rate limits and rate-limit response headers (`x-ratelimit-*`)
- The official API also documents metadata, orders, and historical event endpoints, but those are not surfaced by Phase 6

## Frontend architecture

### Framework and runtime

- Angular 22
- TypeScript
- Angular Material UI
- RxJS

### Current screens

- `DashboardComponent`: displays app title and backend health status
- `SettingsComponent`: placeholder for future configuration/settings screens
- `TradingComponent`: trading/backtesting screen with configuration form, candlestick chart, overlays, metrics, equity curve, and trade history

### Key files

- `apps/web/src/app/app.ts`: application root component
- `apps/web/src/app/app.routes.ts`: route definitions
- `apps/web/src/app/dashboard/dashboard.component.ts`: dashboard implementation
- `apps/web/src/app/settings/settings.component.ts`: settings placeholder

### Routing

- `/` -> trading
- `/trading` -> trading/backtesting page
- `/dashboard` -> dashboard
- `/settings` -> settings page

### Phase 9 UI notes

- The Angular app keeps HTTP access inside a dedicated `TradingApiService`
- The first real trading UI is implemented as a standalone `TradingComponent`
- Candlestick and equity charts use `lightweight-charts`, which fits the current Angular app because it is lightweight, TypeScript-friendly, actively maintained, and supports candlesticks, line overlays, markers, zoom, pan, and responsive resizing
- The candlestick chart renders normalized backend candle data only; no market-data calculation is performed in the frontend
- EMA overlays are rendered from backend signal indicator payloads when available
- RSI is rendered in a secondary chart when the RSI strategy is selected
- BUY and SELL markers are rendered from backend-provided signal timestamps

## Data layer

The application is intentionally minimal at the data layer:

- Postgres is started via Docker Compose
- Prisma is the interface between the NestJS app and the database
- The Candle model now includes broker-aware uniqueness on `(brokerId, symbol, timeframe, openTime)` so multiple market-data providers cannot collide
- The current schema remains intentionally small and extensible for future user/account/trading entities

## Local development flow

- `docker compose up -d` starts PostgreSQL
- `pnpm api:start:dev` starts the NestJS app
- `pnpm web:start` starts Angular dev server

The frontend calls the backend health endpoint to confirm connectivity.

## Design principles

- Keep the foundation simple and production-safe
- Prefer modular app structure over monolithic code
- Favor explicit configuration and typed Prisma models
- Leave space for real trading features without coupling them into the initial shell

## Known next architectural steps

The next natural expansion areas are:

- user/auth domain model
- additional market-data providers and historical sync strategies
- strategy and signal engine
- portfolio/account state
- alerts, jobs, and background workers
- observability and deployment configuration
