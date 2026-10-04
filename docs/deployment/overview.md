# Deployment overview

## Decisions
- Deploy from `main` only.
- Keep ingress public for now.
- Use separate docs for overview, build, and verification.

## Phase plan

### Phase 1 (now)
- Deploy `apps/bybit-market-scanner` to Cloud Run.
- Deploy `apps/web` to Firebase Hosting.
- Route `/api/**` from Firebase Hosting to the scanner Cloud Run service.

### Phase 2 (later)
- Deploy `apps/api` with Cloud SQL + Secret Manager.

## Scope
- Included in current deploy wave: `apps/bybit-market-scanner`, `apps/web`.
- Excluded from current deploy wave: `apps/api`.
