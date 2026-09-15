# ADR-0002: Capability-based broker abstraction

## Status

Accepted

## Date

2026-09-15

## Context

The trading platform needs to support multiple brokers, starting with Bybit and Trading212, without coupling strategy code to any single broker API.

Broker APIs differ significantly in naming, account models, market data access, and trading operations. A single large adapter interface would create artificial requirements for brokers that do not support identical features.

## Decision

Introduce a capability-based broker abstraction layer in the API:

- `BrokerManager` handles registration, lookup, capability checks, and connection lifecycle
- `BrokerAdapter` represents a broker and exposes discoverable capabilities
- Focused capability interfaces are used instead of one large broker contract:
  - `MarketDataProvider`
  - `AccountProvider`
  - `TradingProvider`

Concrete adapters may implement one or more capabilities and expose only the providers they support.

## Consequences

- Strategy code can depend on broker abstractions instead of Bybit- or Trading212-specific implementations
- Future brokers can be added with minimal impact on the Strategy Engine
- Unsupported operations are explicit and can be rejected through capability-aware errors
- Phase 4 remains infrastructure-only and does not require real broker API calls or database changes