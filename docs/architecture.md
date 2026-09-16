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

### Key files

- `apps/api/src/app.module.ts`: root application module
- `apps/api/src/main.ts`: bootstrap entrypoint
- `apps/api/src/modules/config/config.service.ts`: config access
- `apps/api/src/prisma/prisma.service.ts`: Prisma lifecycle management
- `apps/api/prisma/schema.prisma`: database schema

### API conventions

- Global prefix is `/api`
- Health endpoint is `GET /api/health`
- Broker endpoints are read-only in Phase 4: `GET /api/brokers`, `GET /api/brokers/:id`, `GET /api/brokers/:id/capabilities`
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

### Key files

- `apps/web/src/app/app.ts`: application root component
- `apps/web/src/app/app.routes.ts`: route definitions
- `apps/web/src/app/dashboard/dashboard.component.ts`: dashboard implementation
- `apps/web/src/app/settings/settings.component.ts`: settings placeholder

### Routing

- `/` -> dashboard
- `/dashboard` -> dashboard
- `/settings` -> settings page

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
