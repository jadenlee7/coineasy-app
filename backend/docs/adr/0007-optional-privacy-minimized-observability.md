# ADR-0007: Keep observability optional, privacy-minimized, and process-aware

**Status:** Accepted
**Date:** 2026-07-21
**Deciders:** EasyGo backend maintainers

## Context

S9 requires Sentry error reporting, Better Stack (formerly Logtail) structured
logs, and an explicit split between the HTTP application and the segment
worker. Before S9, the Express app was assembled and started in one module,
`/health` did not distinguish process liveness from database readiness, and
only the worker handled shutdown signals.

EasyGo processes identity, wallet, consent, quest, and advertising data. An
observability integration that copies request bodies, authentication headers,
query strings, or user context would violate the roadmap's binding privacy
rules. At the same time, making an external monitoring provider mandatory
would let an outage or a missing credential prevent the product from starting.

Railway deploys one service configuration per process. The web process and the
consent-gated segment worker therefore need separate start contracts even when
they use the same repository and release.

## Decision

Separate Express assembly into `createApp()` and leave network/process startup
in `src/index.js`. Every HTTP request receives a conservative `X-Request-Id`;
request logs include method, path without query string, status, duration, and
that ID.

Expose two unauthenticated, no-store probes:

- `GET /health` is a dependency-free liveness check; and
- `GET /ready` runs a bounded `SELECT 1` and returns `503` without database
  details when the service is not ready.

Continue writing structured Pino logs to stdout. When both
`BETTER_STACK_SOURCE_TOKEN` and `BETTER_STACK_INGESTING_HOST` are present, add
the official `@logtail/pino` transport as a second destination. Missing values
leave remote logging disabled.

Initialize the official `@sentry/node` SDK only when `SENTRY_DSN` is present.
Default tracing to zero and cap an explicitly configured sample rate at 0.2.
Disable default PII and local-variable collection, remove Sentry user context,
request headers, cookies, bodies, and query strings, and strip URL queries
before sending an event. Sentry initialization failure logs a provider-neutral
warning and does not block startup.

Handle `SIGINT`, `SIGTERM`, uncaught exceptions, and unhandled rejections. The
web process stops accepting traffic, waits up to a bounded deadline, stops
Telegram polling, disconnects Prisma, and flushes Sentry. The worker aborts its
loop and performs the same database/telemetry cleanup. Add a `Procfile` with
separate `web` and `worker` commands.

## Options Considered

### Option A: Use only Railway stdout logs

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Error grouping | Weak |
| Cross-release search | Platform-dependent |
| Provider credentials | None |

**Pros:** No new runtime dependencies or external data processor.

**Cons:** Fatal errors are harder to group and alert on, and there is no
intentional long-lived log search contract.

### Option B: Require full Sentry tracing and Better Stack for startup

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Diagnostic depth | High |
| Availability coupling | High |
| Privacy exposure | High unless extensively filtered |

**Pros:** Rich traces and centralized logs from the first production request.

**Cons:** Missing or unhealthy provider configuration can become a deployment
failure, and automatic request capture expands the PII surface.

### Option C: Optional error monitoring plus redacted dual-destination logs

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Diagnostic depth | Sufficient for S9 |
| Availability coupling | Low |
| Privacy exposure | Explicitly minimized |

**Pros:** Adds searchable logs, grouped errors, request correlation, readiness,
and clean shutdown without making external telemetry a runtime prerequisite.

**Cons:** Tracing is intentionally limited, external dashboards still require
operator setup, and the application owns sanitization tests.

## Trade-off Analysis

Option C meets the S9 operational need while preserving fail-open behavior for
monitoring providers and fail-closed behavior for database readiness. It gives
up automatic high-cardinality request details and full distributed tracing.
That is appropriate because EasyGo's current risk is silent process failure,
not missing per-user traces, and the discarded fields are precisely the fields
most likely to contain identity or wallet data.

The readiness query adds one database round trip per probe. Railway should use
a moderate probe interval; the query is static, bounded at the HTTP response
level, and does not expose failure details.

## Consequences

- Current feature flags and route behavior remain unchanged.
- Local development and deployments without telemetry credentials continue to
  work and log to their existing console/stdout destination.
- Operators can correlate a client-visible request ID with one sanitized log
  event without logging request query/body data.
- `/health` can stay green while `/ready` is red during a database incident,
  preventing new traffic from reaching an unready instance.
- Web and worker can be scaled, restarted, and rolled back independently.
- Sentry and Better Stack become subprocessors only when their production
  credentials are configured; policy/vendor approval remains an activation
  gate.
- No schema or database migration is introduced by S9.

## Action Items

1. [x] Separate application assembly from process startup.
2. [x] Add request IDs, liveness/readiness probes, terminal error handling, and
   graceful shutdown.
3. [x] Add optional Sentry and Better Stack integrations with privacy tests.
4. [x] Add explicit web/worker Procfile commands and an operations runbook.
5. [ ] Create production Sentry and Better Stack projects after privacy/vendor
   approval and store credentials only in Railway secrets.
6. [ ] Configure two Railway services from the same release and point the web
   health check at `/ready`.
7. [ ] Run the production probe, signal, alert, and rollback drills before
   enabling S5 or S7.
