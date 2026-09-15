# ADR-0003: Read-only Bybit public market-data adapter

## Status

Accepted

## Date

2026-09-15

## Context

The platform needs a production-safe way to fetch Bybit market data without coupling the application to Bybit-specific response shapes or requiring private API credentials for basic market access.

Bybit v5 exposes public spot market-data endpoints for instruments and klines. These endpoints are sufficient for Phase 5, while trading and account operations remain out of scope until later phases.

## Decision

- Implement a dedicated Bybit HTTP client under the broker infrastructure layer
- Keep the adapter read-only and advertise only `BrokerCapability.MARKET_DATA`
- Map Bybit public responses into the existing broker domain models before returning data to the API layer
- Normalize candles into chronological order (`oldest → newest`) before exposing them through the broker API
- Allow public market-data calls without API credentials, while keeping optional credential configuration available for later phases

## Consequences

- The API can expose Bybit market data now without introducing order execution or account management
- Bybit-specific request/response handling stays isolated from the domain and application layers
- Unsupported features such as trading remain explicit and cannot be reached through the Bybit adapter in Phase 5
