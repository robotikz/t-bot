# ADR 0001: Centralized application infrastructure

- Status: Accepted
- Date: 2026-09-09

## Context

The API foundation needed a predictable way to manage environment configuration, database connectivity, request lifecycle logging, validation, and response consistency. The project already had a minimal NestJS shell with Prisma and a health endpoint, but it lacked typed configuration, centralized error handling, and a reusable infrastructure layer.

## Decision

We implemented a minimal but reusable infrastructure layer around the existing NestJS app:

- `@nestjs/config` with a typed centralized config service
- a singleton global Prisma service with startup/connectivity checks and graceful shutdown hooks
- a shared application logger and request lifecycle middleware
- global validation, exception filtering, and response formatting
- a health endpoint that confirms both application and PostgreSQL readiness

The design keeps all environment access behind the config layer and avoids adding business-domain abstractions beyond the existing bootstrap model.

## Consequences

- Future modules can rely on consistent config, logging, validation, and response contracts.
- Database and HTTP failures are handled through one consistent error envelope.
- The API remains simple and production-friendly without introducing trading logic or domain-specific services.
- The architecture remains extensible for the next phases: users, domains, and market data.
