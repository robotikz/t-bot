# Deployment build

## Current deploy targets
- Scanner service: `apps/bybit-market-scanner`
- Web app: `apps/web`

## Build commands
- Scanner build: `pnpm scanner:build`
- Web build: `pnpm web:build`

## Runtime targets
- Scanner -> Cloud Run service (public ingress).
- Web -> Firebase Hosting.

## Routing contract
- Web uses `/api` base URL.
- Firebase Hosting rewrites `/api/**` to the scanner Cloud Run service.

## Branch policy
- Deploy workflows run from `main` only.
