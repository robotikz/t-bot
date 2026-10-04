# Deployment verification

## CI/CD checks
1. Confirm scanner deploy workflow completed from `main`.
2. Confirm web deploy workflow completed from `main`.

## Runtime checks
1. Open Firebase Hosting URL and confirm app loads.
2. Call `/api/health` from the hosted domain and confirm `{ "status": "ok" }`.
3. Trigger scan from UI and confirm candidates are returned.

## Scope checks
1. Confirm scanner and web were deployed.
2. Confirm API (`apps/api`) was not deployed in this phase.
