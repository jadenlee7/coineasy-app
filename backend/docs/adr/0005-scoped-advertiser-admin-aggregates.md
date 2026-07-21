# ADR-0005: Scope advertiser administration with hashed keys and suppressed aggregates

**Status:** Accepted
**Date:** 2026-07-21
**Deciders:** EasyGo backend maintainers

## Context

S7 must let each advertiser manage only its own campaigns and read campaign
performance without exposing EasyGo users, wallet addresses, segment rules, or
quest proof data. The S2 `Advertiser` and `Campaign` models deliberately have
no credential fields, and the roadmap fixes S7 to no database migration.

A single global admin secret would make advertiser isolation depend on a
request parameter. Returning small aggregate counts would also permit practical
re-identification when an advertiser targets a narrow segment or compares
overlapping campaigns. Per-quest wallet-sharing consent exists, but S7 does not
yet define a delivery contract, retention window, or revocation behavior for
exporting those addresses.

## Decision

Keep the S7 surface behind `ADVERTISER_ADMIN_ENABLED=false`. Authenticate
`Authorization: Bearer` keys against an environment-provided mapping from
advertiser slug to SHA-256 key digest. Raw keys are never stored in the database
or configuration, and digest comparisons use constant-time equality. The
resolved active `Advertiser` row becomes the authorization scope; callers
cannot choose an advertiser ID.

Expose advertiser-self metadata plus scoped campaign list, create, detail,
update, and aggregate report endpoints. New campaigns always start `DRAFT`.
Campaign lifecycle transitions are explicit, archived campaigns are immutable,
and activation requires at least one active quest plus an active target segment
when a target is configured.

Reports return only:

- campaign and public quest metadata;
- current consent-eligible audience size; and
- aggregate completion-status counts.

Every numeric audience or completion result is suppressed until it reaches a
configurable cohort threshold that is never lower than ten. Responses and
queries never select email, Privy identity, wallet address, verification proof,
quiz answer digest, or segment rule JSON. Per-quest wallet opt-in does not create
an address-export endpoint in S7.

## Options Considered

### Option A: Reuse one global admin secret

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Credential isolation | Poor |
| Revocation | All advertisers at once |
| Migration | None |

**Pros:** Smallest implementation and compatible with the existing internal
Orange grant endpoint.

**Cons:** One leak compromises every advertiser, and advertiser scoping must
trust a caller-controlled identifier.

### Option B: Store a key hash on each advertiser

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Credential isolation | Strong |
| Revocation | Per advertiser |
| Migration | Required |

**Pros:** Database-managed provisioning, rotation metadata, and simpler runtime
lookup.

**Cons:** Violates the locked no-migration S7 scope and needs a separate secure
provisioning workflow.

### Option C: Map advertiser slugs to key hashes in server configuration

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Credential isolation | Strong for S7 scale |
| Revocation | Per advertiser deployment |
| Migration | None |

**Pros:** Separate scoped credentials, no raw secrets at rest in application
configuration, and no schema change.

**Cons:** Rotation requires an environment update and deployment. Large numbers
of advertisers will outgrow configuration-based provisioning.

## Trade-off Analysis

Option C is the only choice that meets both advertiser isolation and the S7
no-migration constraint. It deliberately accepts operational key rotation for
an early, small advertiser cohort. Cohort suppression reduces immediate
re-identification risk but does not replace a future differential-privacy or
query-budget system for arbitrary advertiser-defined analytics.

## Consequences

- A configured key can access only the advertiser selected by its server-side
  digest mapping.
- An advertiser must be `ACTIVE`; draft, suspended, and archived advertisers
  cannot use the API.
- Small audience and completion results are returned as suppressed `null`
  values, not exact zeros or counts.
- Campaigns can be archived but not deleted, preserving attribution history.
- S7 does not expose opted-in wallet addresses. A later export feature needs a
  separate ADR covering purpose, delivery, revocation, retention, and audit.
- A later provisioning migration should replace the environment mapping with
  independently rotatable credential records or an external API gateway.

## Action Items

1. [x] Add constant-time advertiser-key authentication behind the default-off flag.
2. [x] Add advertiser-scoped campaign lifecycle routes.
3. [x] Add consent-filtered, minimum-cohort aggregate reports.
4. [x] Add authorization and aggregate-only response tests.
5. [ ] Provision production advertisers and keys only after legal, privacy,
   campaign-content, and operational review.
6. [ ] Design audited wallet-sharing delivery separately before exposing any
   per-user address.
