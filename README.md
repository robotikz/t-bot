# Trading Platform MVP

This repository contains a minimal production-ready foundation for an algorithmic trading platform.

## Stack

- Node.js 22 LTS
- NestJS
- Angular
- Angular Material
- Prisma
- PostgreSQL
- Docker Compose
- pnpm

## Repository structure

```text
trading-platform/
  apps/
    api/
    web/
  packages/
    shared/
  docker/
  docs/
  .env.example
  docker-compose.yml
  pnpm-workspace.yaml
  README.md
```

## Install dependencies

```bash
pnpm install
```

## Start PostgreSQL

```bash
docker compose up -d
```

## Run backend

```bash
pnpm api:start:dev
```

## Run frontend

```bash
pnpm web:start
```

## Health check

Backend:

```text
http://localhost:3000/api/health
```

Response:

```json
{
  "status": "ok"
}
```

Frontend:

```text
http://localhost:4200
```

## Prisma

Set the database URL in `.env` based on `.env.example` and then run:

```bash
pnpm --dir apps/api exec prisma generate
pnpm --dir apps/api exec prisma db push
```

## Notes

This project deliberately excludes authentication, exchange APIs, trading logic, background jobs, and other future features so the foundation remains simple and easy to extend.
