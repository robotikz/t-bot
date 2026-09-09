# Roadmap

## Current status

The repository is in the foundation phase. The base monorepo, backend, frontend, Prisma, and local Docker/database setup are already in place.

## Phase 1: Platform foundation

Status: Complete

- pnpm workspace monorepo
- NestJS backend shell
- Angular frontend shell
- Prisma + PostgreSQL setup
- Docker Compose local environment
- health-check and basic UI wiring

## Phase 2: Product and domain model

Status: Planned

- user/account domain model
- application configuration storage
- roles and permissions as needed
- shared DTO and validation patterns
- service boundaries for trading features

## Phase 3: Market data and execution

Status: Planned

- exchange/account connection layer
- market-data adapters
- symbol and instrument models
- order placement and event handling
- execution tracking and trade records

## Phase 4: Strategy and automation

Status: Planned

- strategy definitions and lifecycle
- signal generation and backtests
- scheduler/background jobs
- risk checks and guardrails
- alerting and monitoring

## Phase 5: Operations and deployment

Status: Planned

- production-ready env handling
- CI/CD pipeline
- containerized deployments
- observability and logs
- error tracking and health monitoring

## Immediate next steps

1. Confirm the baseline API and frontend run reliably in the local environment.
2. Add a stronger domain model around users and configuration.
3. Define the first real business service beyond the health endpoint.
4. Introduce a minimal market-data or account abstraction to anchor the next feature work.

## Guidance for future work

Each new milestone should be implemented in a way that preserves the clean separation between:

- app shell and UI
- API modules and services
- data models and Prisma schema
- shared utilities

This keeps the repo maintainable as the trading stack expands.
