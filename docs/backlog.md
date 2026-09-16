# Backlog (post Phase 2)

- Run `pnpm --dir apps/api exec prisma generate` and `prisma db push`
- Add unit/e2e tests for health endpoint and PrismaService
- Wire frontend dashboard to call /api/health
- Add CI pipeline for lint/build/test
- Add config validation and ADR for pnpm/prisma choices

## Phase 2 completion notes

- Core infrastructure is complete: configuration, database lifecycle, logging, validation, error handling, response shaping, and health checks are in place.
- The next backlog items should begin with user/domain modeling and the first actual business module beyond the health endpoint.

## Phase 3 (Domain Foundation)

- ✓ Add domain models and repository pattern
- ✓ Add read-only REST endpoints for exchanges, strategies, candles, orders, trades
- ✓ Run Prisma generate / db push and seed initial exchanges and strategies
- Add unit tests for repository and service layers
- Add e2e tests for REST endpoints
- Implement validation rules and error responses for invalid query parameters

## Future phases (post Phase 4)

- Phase 5: Market Data – completed with the read-only Bybit adapter and market-data HTTP client
- Phase 6: Trading212 read-only adapter – completed with account and position support aligned to the official API
- Next platform phases: order management/execution, broader market-data ingestion, strategy execution, and backtesting

## Broker integration backlog

- Extend broker abstractions if a future read-only history provider is introduced
- Add market-data capability implementations for additional brokers beyond Bybit
- Add broker authentication flows and credential validation for any future trading-capable adapters
- Add broker health monitoring and connection diagnostics
- Add capability-specific integration tests for broker adapters
- Revisit Trading212 if the official API adds candle or broader market-data support later

## Market-data follow-up backlog

- Add incremental historical synchronization so the engine can backfill more than one page at a time for long date ranges
- Add broker-specific market-data health diagnostics and latency tracking
- Add optional market-data repair/replay workflows for future backtesting import jobs
- Extend the market-data engine with additional providers once more brokers expose compatible candle feeds
- Add repository-level integration coverage against a disposable test database for the Candle unique constraint and idempotent upserts

## Strategy engine follow-up backlog (post Phase 8)

- Backtesting engine for historical strategy replay
- Strategy parameter optimization workflows
- Strategy performance metrics and reporting
- Signal persistence and audit history
- Paper-trading execution pipeline
- Risk management rules and pre-trade controls
- Position sizing framework
- Order execution engine and broker trading adapters
- Live trading lifecycle and safety controls
- Strategy scheduling and background workers
- WebSocket market-data ingestion support

## Remaining backlog (post Phase 2)

- Add user/account domain model and schema expansion beyond the bootstrap model
- Introduce application-level DTOs for future business modules
- Add structured integration tests for config, health endpoint, and Prisma connectivity
- Add CI pipeline for lint/build/test validation
- Define the first real business service boundary after infrastructure stabilization
- Extend the frontend to consume the normalized API response contract and health status
- Add deployment and environment hardening for non-local scenarios
