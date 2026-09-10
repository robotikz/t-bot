# Backlog (post Phase 2)

- Run `pnpm --dir apps/api exec prisma generate` and `prisma db push`
- Add unit/e2e tests for health endpoint and PrismaService
- Wire frontend dashboard to call /api/health
- Add CI pipeline for lint/build/test
- Add config validation and ADR for pnpm/prisma choices

## Phase 2 completion notes

- Core infrastructure is complete: configuration, database lifecycle, logging, validation, error handling, response shaping, and health checks are in place.
- The next backlog items should begin with user/domain modeling and the first actual business module beyond the health endpoint.

## Remaining backlog (post Phase 2)

- Add user/account domain model and schema expansion beyond the bootstrap model
- Introduce application-level DTOs for future business modules
- Add structured integration tests for config, health endpoint, and Prisma connectivity
- Add CI pipeline for lint/build/test validation
- Define the first real business service boundary after infrastructure stabilization
- Extend the frontend to consume the normalized API response contract and health status
- Add deployment and environment hardening for non-local scenarios
