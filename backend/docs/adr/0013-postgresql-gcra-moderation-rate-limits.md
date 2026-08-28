# ADR-0013: Persist moderation GCRA buckets in PostgreSQL

**Status:** Proposed
**Date:** 2026-08-27
**Deciders:** Product, Backend, Security, Privacy/Legal, and Operations

## Context

ADR-0012 established an actor-only rate-limit middleware contract for the
protected moderation surface. A process-local limiter would reset on deploy
and disagree across Railway replicas. An IP limiter would identify a proxy or
network rather than the authenticated workforce actor. Moderation therefore
needs shared, bounded, fail-closed state before any source or runtime gate can
be considered for activation.

The current routes can require one scope or a compound scope set. In
particular, post removal requires both `report.decide` and `content.remove`.
Consuming only one of those buckets before rejecting the other would create
partial state and unpredictable retries. App-server clocks may also differ,
and Prisma does not directly cancel an in-flight PostgreSQL query with the
middleware's `AbortSignal`.

This ADR covers only a dormant persistence and consumer foundation. It does
not approve thresholds, retention, a cleanup schedule, a workforce provider,
singleton wiring, migration execution, deployment, or moderation activation.

## Requirements and constraints

- one bounded row per opaque `(actorId, scope)`, never a request-event ledger;
- exact support for `queue.read`, `report.claim`, `report.decide`, and
  `content.remove` only;
- deterministic serialization across processes and replicas;
- one database clock sample after all locks are held;
- all requested scopes accepted and written together, or no bucket written;
- exact middleware results: `{ allowed: true }` or a bounded denial with an
  integer `retryAfterSeconds` from 1 through 3600;
- database deadlines that finish before the middleware's two-second deadline;
- no bearer token, provider subject, role, IP, request, report, post, or UGC in
  the table, errors, or logs; and
- source latch, runtime gate, preflight, and singleton behavior remain closed.

## Decision

Use a PostgreSQL-backed Generic Cell Rate Algorithm (GCRA) consumer injected
through the existing `consume({ actorId, scopes }, { signal })` interface.

### Persistence

`ModerationRateLimitBucket` uses `(actorId, scope)` as its only key and stores:

- an explicit approved `policyVersion`;
- a SHA-256 `policyFingerprint` over the algorithm version, policy version,
  scope, emission interval, and burst capacity;
- `theoreticalArrivalAt` (TAT); and
- `updatedAt`, written from the same database clock as the TAT decision.

The fingerprint prevents a rolling deploy from silently reusing one policy
version with different thresholds. A stored version or fingerprint mismatch
does not reset or overwrite a bucket; it fails closed as storage unavailable.
Changing a policy therefore requires a separately approved transition after
the old maximum debt horizon has drained or a reviewed conservative state
transition has been applied.

The table has no default or Prisma `@updatedAt` clock. Raw transactional SQL
writes both timestamps from `clock_timestamp()`. Database checks restrict the
actor shape, exact scope set, policy shapes, fingerprint, and
`theoreticalArrivalAt >= updatedAt`.

### GCRA calculation

For each scope:

```text
T         = approved emission interval
B         = approved burst capacity
tolerance = (B - 1) * T
baseTAT   = max(storedTAT, databaseNow)
allowAt   = baseTAT - tolerance
nextTAT   = baseTAT + T
```

The request conforms only when `databaseNow >= allowAt` for every requested
scope. `(B - 1)`, rather than `B`, ensures exactly `B` immediate requests are
possible and closes a one-extra-request error.

Policies are mandatory injected configuration with no production defaults.
Each emission interval must be an integer from 1,000 through 3,600,000 ms;
burst capacity must be from 1 through 100; and interval times burst must not
exceed 3,600,000 ms. These are safety bounds, not approved EasyGo thresholds.

### Transaction and concurrency

The consumer validates and sorts scopes, then acquires one namespaced
transaction advisory lock per actor/scope in lexical scope order. Hash
collisions can only create conservative contention. Session advisory locks are
not used.

After all locks are held, one `MATERIALIZED` CTE samples
`clock_timestamp()`. A second CTE evaluates every bucket. The write CTE runs
only when every scope conforms and there is no policy mismatch. A denial or
contract mismatch writes zero buckets. The returned row count must exactly
match the requested scope count; any malformed or ambiguous result fails
closed with no internal retry.

The consumer configures database-side lock, statement, and idle transaction
timeouts and also configures Prisma interactive-transaction max-wait and
timeout. Their combined maximum must finish at least 250 ms before the outer
dependency deadline. The returned consumer carries a non-enumerable,
immutable deadline marker; middleware construction rejects a different outer
deadline or an unmarked wrapper rather than permitting the HTTP timeout and DB
transaction budgets to drift. An intentional wrapper must explicitly re-bind
the same deadline. The consumer checks the supplied abort signal before the
transaction, between locks, and after the consume statement; an abort after
the statement throws inside the callback so PostgreSQL rolls back before
commit. No Promise-race-only cancellation is used inside the consumer.

### Cleanup and retention

Cleanup is not executed on the request path and is not scheduled by this
change. The bounded candidate SQL:

1. samples the database clock once;
2. selects rows older than the approved retention whose TAT is already at or
   before that clock;
3. orders by `updatedAt`, TAT, actor, and scope;
4. locks a bounded batch with `FOR UPDATE SKIP LOCKED`; and
5. deletes only that batch, returning only a count.

An active future TAT must never be deleted, even when `updatedAt` appears old.
Offboarding denies access but does not immediately purge rate debt. Retention,
batch size, schedule, monitoring, database access, and backup retention require
Privacy/Legal, Security, and Operations approval.

### Readiness and recovery

A separate catalog verifier checks the exact completed and non-rolled-back
migration receipt, six exact columns, validated named constraints, ordered
primary/cleanup indexes, and current-user DML privileges. It does not scan
bucket values. Future activation readiness must AND this verifier with the
existing queue contract; it must never relax either contract with an OR.

The migration is additive: one new table and one index in one transaction,
with no existing-table lock, backfill, foreign key, or destructive statement.
Rollback to an older gate-off app leaves the table in place. A down migration
or manual table drop is not part of rollback.

A restored old backup can erase newer rate debt and is therefore potentially
fail-open. After restore, moderation remains gate-off for the approved maximum
full-debt horizon (bounded here to one hour) unless a reviewed conservative
reconstruction and catalog readback proves equivalent protection.

## Options considered

### PostgreSQL GCRA (selected)

**Pros:** reuses the existing durable store, works across replicas, supports
transactional compound scopes, and needs only one bounded row per bucket.

**Cons:** adds database contention and operational migration/retention work;
Prisma requires explicit database-side deadlines for bounded cancellation.

### Process-local token bucket

**Pros:** simple and low latency.

**Cons:** resets on deploy and diverges across processes, so it cannot enforce
an irreversible moderation boundary.

### IP or forwarded-address limiter

**Pros:** useful for broad unauthenticated edge abuse.

**Cons:** does not identify the authenticated reviewer, creates proxy-trust and
privacy issues, and cannot replace actor authorization.

### Per-request event ledger

**Pros:** detailed forensic history.

**Cons:** unbounded growth and unnecessary workforce activity tracking. The
moderation audit already records committed actions; denied/read attempts do not
belong in a new identity-linked event ledger.

### External Redis limiter

**Pros:** common low-latency primitives and independent scaling.

**Cons:** introduces another production dependency, backup/access policy, and
failure mode while PostgreSQL already satisfies the expected low reviewer
cardinality. Revisit only if measured contention or latency requires it.

## Consequences

- Multi-replica and compound-scope enforcement can be tested without enabling
  moderation.
- Threshold changes become explicit policy transitions rather than silent
  runtime edits.
- Store outages, schema drift, policy drift, timeout, and malformed results
  deliberately make moderation unavailable.
- Opaque actor IDs plus timestamps remain pseudonymous workforce activity
  metadata and require least privilege, retention, and backup controls.
- The request path gains a small bounded number of PostgreSQL queries and
  advisory locks; actual staging latency must be measured before activation.

## Activation boundary and action items

1. [ ] Product, Backend, Security, Privacy/Legal, and Operations accept this
   ADR and approve exact per-scope thresholds and policy version.
2. [ ] Approve retention, cleanup batch/schedule, least-privilege role,
   monitoring, encrypted backup, restore drill, and stale-backup recovery hold.
3. [ ] Apply the additive migration only after an exact encrypted backup and
   restore validation, target identity readback, maintenance drain, and a
   separate explicit approval.
4. [ ] Deploy the exact gate-off release and verify catalog, timeout, cleanup,
   contention, and rollback evidence without reviewer actions.
5. [ ] Select and verify workforce OIDC, access storage, and offboarding.
6. [ ] Use a later explicit approval to wire the singleton, change the source
   latch, enable Railway configuration, or perform a moderation operation.

Until every applicable item is complete, `POST_MODERATION_READY` remains
hard-coded `false` and the new table/consumer must not be treated as deployed or
activation-ready.
