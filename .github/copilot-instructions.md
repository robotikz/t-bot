# Copilot Instructions for t-bot

## Big picture
- Monorepo with pnpm workspaces: backend in apps/api, frontend in apps/web, shared enums in packages/shared.
- API is NestJS 12 + Prisma + PostgreSQL; Web is Angular 22 standalone-component style.
- Current trading architecture is capability-based broker abstraction (ADR-0002) plus a broker-agnostic market-data engine (ADR-0005).

## Backend architecture you must preserve
- Keep module boundaries: domain/application/infrastructure inside broker and market-data areas.
- Broker access goes through `BrokerManager` (`apps/api/src/modules/brokers/application/broker-manager.ts`), not direct adapter construction in controllers/services.
- Broker registration is config-driven in `BrokerRegistryService` (`.../brokers/infrastructure/registry/broker-registry.service.ts`) using `BYBIT_ENABLED` / `TRADING212_ENABLED`.
- API responses are globally wrapped by `ResponseInterceptor` (`{ success: true, data }`) and errors by `HttpExceptionFilter` (`{ success: false, message, path, timestamp }`).
- Validation is strict (`ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, transform enabled in `apps/api/src/main.ts`).

## Market-data flow (important)
- Read path: controller -> `MarketDataService.getCandles()` -> `CandleRepository.findByBrokerSymbolTimeframe()`.
- Load path: controller `/market-data/candles/load` -> `MarketDataService.loadCandles()` -> broker provider paging -> `ingestCandles()` -> Prisma upsert.
- Candle identity is broker-aware: `brokerId + symbol + timeframe + openTime` (unique DB key in Prisma schema + repository upsert).
- Preserve chronological ordering (`oldest -> newest`) in adapters/services/repository.

## Project-specific coding conventions
- API package uses ESM with NodeNext; keep relative imports ending in `.js` in TypeScript source.
- Use DTOs + `class-validator`/`class-transformer` for query params (see market-data and candles DTOs).
- Keep broker capabilities explicit (`MARKET_DATA`, `ACCOUNT`, `TRADING`) and capability-gate behavior via `BrokerManager`.
- Prefer extending existing module patterns (controller + service + repository) over adding cross-module shortcuts.

## Dev workflows (verified from this repo)
- Install deps: `pnpm install` (repo root).
- Start DB: `docker compose up -d` (Postgres 17 from `docker-compose.yml`).
- Run API dev: `pnpm --dir apps/api start:dev`.
- Build API: `pnpm --dir apps/api run build`.
- Run API tests: `pnpm --dir apps/api test`.
- Run API e2e specs: `pnpm --dir apps/api exec vitest run -c vitest.config.e2e.ts`.
- Run web dev: `pnpm --dir apps/web start`.

## Integration points
- Health endpoint is `GET /api/health`; frontend dashboard currently calls `http://localhost:3000/api/health` directly.
- Key env vars live in `.env.example` (database URL, API prefix, CORS frontend URL, broker toggles, market-data max candle cap).
- Bybit integration is public market data; Trading212 integration is read-only account/positions.

## When changing schema or market data
- Update Prisma schema and keep migration + repository behavior aligned with candle uniqueness and ordering assumptions.
- Do not remove broker-aware candle uniqueness or `isClosed` timestamp-based derivation in `MarketDataService`.
