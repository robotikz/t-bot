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

- Phase 5: Market Data – integrate candle fetching through broker adapters
- Phase 6: Order Management – implement order creation, tracking, and execution through broker trading capabilities
- Phase 7: Backtesting – historical analysis and strategy validation

## Broker integration backlog

- Implement `BybitBrokerAdapter` real API integration
- Implement `Trading212BrokerAdapter` real API integration
- Add market-data capability implementations for supported brokers
- Add broker authentication flows and credential validation
- Add broker health monitoring and connection diagnostics
- Add capability-specific integration tests for broker adapters

## Remaining backlog (post Phase 2)

- Add user/account domain model and schema expansion beyond the bootstrap model
- Introduce application-level DTOs for future business modules
- Add structured integration tests for config, health endpoint, and Prisma connectivity
- Add CI pipeline for lint/build/test validation
- Define the first real business service boundary after infrastructure stabilization
- Extend the frontend to consume the normalized API response contract and health status
- Add deployment and environment hardening for non-local scenarios
