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

- The current Bybit and Trading212 adapters are placeholders for registration and discovery only
- No external broker API calls are performed in this phase
- No secrets are returned by broker endpoints
- No database changes were required because the abstraction layer is in-memory and configuration-driven

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
- The current schema is intentionally small and extensible for future user/account/trading entities

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
- market-data adapters and ingestion pipelines
- strategy and signal engine
- portfolio/account state
- alerts, jobs, and background workers
- observability and deployment configuration
