# GEMINI.md

## Project overview

This repository is a monorepo for a trading platform MVP built with:

- Node.js 22
- pnpm workspaces
- NestJS API in `apps/api`
- Angular web app in `apps/web`
- PostgreSQL via Docker Compose
- Prisma as the ORM

## Operating rules for AI assistants

- Keep the task brief: the user prompt should describe only the current task in 2–5 lines.
- Use the repository as the source of truth; do not re-paste long project specs into every prompt.
- Prefer edits in the relevant app/package, not broad sweeping changes.
- Reuse existing patterns in the codebase before introducing new abstractions.
- Keep changes minimal, explicit, and consistent with the existing NestJS/Angular structure.
- Respect the current foundation: this is a trading platform starter, not a full exchange implementation.

## Repo layout

- `apps/api`: NestJS backend, Prisma schema, environment config, health endpoints
- `apps/web`: Angular frontend with dashboard/settings screens
- `packages/shared`: shared code for future cross-app types/utilities
- `docker/`: deployment or container support files
- `docs/`: project architecture and roadmap documents
- `docker-compose.yml`: local Postgres service
- `package.json`: root workspace scripts

## Common commands

```bash
pnpm install

docker compose up -d
pnpm api:start:dev
pnpm web:start
```

## Current project intent

This repo is intentionally a minimal foundation for later trading features. It includes:

- backend health checks
- Prisma + PostgreSQL connectivity
- Angular shell and dashboard
- Dockerized local development environment

It does not yet include authentication, exchange integrations, market data ingestion, strategy execution, or production deployment workflows.

## Change guidelines

- Keep API routes under `/api` unless the task clearly requires otherwise.
- Prefer existing NestJS module conventions (`config`, `prisma`, `health`) for new backend features.
- Prefer Angular standalone components and existing app structure for frontend work.
- When adding database models, update `apps/api/prisma/schema.prisma` and keep Prisma usage consistent.
- If the task adds a new business capability, document it in `docs/architecture.md` or `docs/roadmap.md` rather than burying it in ephemeral chat context.
