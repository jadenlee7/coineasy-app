# ADR-0012: Verify workforce OIDC and rate-limit moderation by opaque actor

**Status:** Proposed
**Date:** 2026-08-27
**Owners:** Product, Backend, Security, Privacy/Legal, Operations

## Context

[ADR-0011](./0011-protected-post-report-moderation.md) requires the post-report
moderation surface to use a separate workforce trust domain. The current source
candidate still has a legacy hashed-key authenticator, and the strict workforce
principal deliberately rejects that identity at the authorization boundary.
It also has no shared operator rate-limit store.

Static reviewer keys do not provide session expiry, recent MFA evidence,
individual offboarding, or server-owned role assignment. IP-based limits are
also unsuitable for this surface: several reviewers can share an egress IP,
proxy headers are not an authenticated actor identity, and a process-local map
would reset or diverge across Railway replicas.

This ADR defines a dormant, provider-neutral foundation. It does not select an
identity provider, provision a reviewer, add Railway variables, create or apply
a database migration, replace the production singleton authenticator, deploy,
or open the source activation latch.

## Decision

Use two separate authentication stages and one actor-only rate-limit stage:

1. A workforce OIDC verifier validates the compact JWT, pinned asymmetric
   algorithm, exact HTTPS issuer, dedicated moderation audience, explicit token
   type, server-selected key resolver, bounded `kid`, session times, and
   provider-adapted MFA evidence.
2. A server-owned access resolver maps only verified `(issuer, subject,
   roleIds)` to an opaque `wf_...` actor ID and an exact allowlist of moderation
   capabilities. Token role values are mapping inputs, never capabilities.
3. After RBAC authorization, an actor limiter consumes only the opaque actor ID
   and the authorized route scopes. It never accepts an IP address, forwarded
   header, bearer token, provider subject, or request body as a key.

The route order is fixed:

```text
Cache-Control: no-store
  -> source/runtime gate
  -> workforce authentication
  -> capability and recent-MFA authorization
  -> opaque-actor rate limit
  -> moderation service
```

The default limiter has no storage implementation and therefore returns a
sanitized `503 moderation_rate_limit_unconfigured`. Tests can inject an
explicit limiter. This prevents route plumbing from silently running without a
distributed limit.

## OIDC verifier contract

- Accept one bounded three-segment JWT. Reject static EasyGo keys, app user
  tokens, ID tokens for another audience, and token-provided key URLs.
- Pin one exact HTTPS issuer, one dedicated audience, an explicit `typ`, and an
  allowlist limited to `RS256` and/or `ES256`. Multi-audience tokens are
  rejected.
- Obtain keys only from a server-owned resolver. The supplied remote-JWKS
  helper requires HTTPS, refuses redirects, hard-aborts headers and body after
  four seconds, caps the document at 256 KiB and 64 keys, and applies a
  ten-minute cache plus thirty-second unknown-key cooldown. Provider selection
  and its JWKS URL remain an activation decision.
- Require signed safe-integer `iat`, `exp`, and MFA authentication time. Enforce
  the existing eight-hour session/MFA hard ceilings; a provider-specific policy
  may only shorten them. Destructive removal retains ADR-0011's fifteen-minute
  recent-MFA boundary.
- Require the provider adapter to prove MFA from an exact provider-approved
  `acr` plus the complete required `amr` combination, or a separately reviewed
  provider-specific predicate. Any-match AMR, claim presence, and a
  client-supplied boolean are insufficient.
- Return only issuer, immutable subject, bounded role IDs, issued/expiry times,
  and MFA time. Do not attach the raw token or full claims to the request.
- Give claim adapters an immutable bounded snapshot. Give token verification
  and access resolution separate four-second abort signals so a stalled JWKS
  body, verifier, or workforce directory cannot retain a request indefinitely.

## Access-resolution contract

The resolver is server-owned and fail-closed. It must:

- match the exact issuer and immutable subject against a provisioned,
  non-offboarded workforce record;
- generate or retrieve a stable opaque actor ID matching `wf_...` without
  storing the raw provider subject in moderation audit records;
- map approved provider roles to only `queue.read`, `report.claim`,
  `report.decide`, `content.remove`, `audit.read`, and `access.admin`;
- provide no wildcard, default grant, token-supplied capability, email/name
  identity key, or fallback to the legacy static key authenticator.

The chosen provider, subject-protection method, role mapping, offboarding SLA,
access review, break-glass path, and resolver persistence are intentionally
unselected. They require Security and Operations approval before singleton
wiring.

## Distributed rate-limit contract

The activation implementation will use PostgreSQL-backed GCRA state, not an
in-memory map or IP limiter. The proposed persistence shape is one bounded row
per `(actorId, scope)` with the theoretical arrival time and update timestamp.
The consumer must:

- serialize each actor/scope bucket with a transaction-scoped PostgreSQL
  advisory lock;
- use the database clock so replicas do not disagree;
- evaluate all scopes for a request atomically, including both
  `report.decide` and `content.remove` for removal;
- return either exact `{ allowed: true }` or
  `{ allowed: false, retryAfterSeconds }`, where retry is an integer from 1 to
  3600;
- avoid a per-request event ledger and define cleanup for stale state rows.
- honor the supplied two-second abort signal; timeout, schema mismatch, or an
  invalid result fails closed as unavailable.

Queue, claim, decision, and removal limits remain separately configurable.
Unauthenticated flood protection belongs at the managed edge and is not a
substitute for this actor limit.

The schema, migration, concrete GCRA consumer, thresholds, retention period,
backup/restore evidence, and Railway rollout are deferred to a separate
approved change.

## Failure and privacy contract

| Condition | Result |
| --- | --- |
| Source/runtime gate off | `404 not_found`; no auth, JWKS, resolver, limiter, or service call |
| Missing, malformed, expired, wrong issuer/audience/type/MFA token | `401 invalid_moderation_identity` |
| Valid identity not provisioned or missing a required capability | `403 moderation_forbidden` |
| Invalid OIDC/access configuration | `503 moderation_auth_unconfigured` |
| OIDC/JWKS/access dependency outage | `503 moderation_auth_unavailable` |
| Missing rate-limit consumer | `503 moderation_rate_limit_unconfigured` |
| Rate-store outage or invalid result | `503 moderation_rate_limit_unavailable` |
| Actor bucket exhausted | `429 moderation_rate_limited` plus bounded integer `Retry-After` |

Responses and logs must not contain bearer tokens, provider subjects, claims,
role IDs, actor IDs, JWK/JWKS data, IP addresses, or provider error messages.
Outage logs contain only a fixed internal error classification, never an
arbitrary dependency-provided error name. Logger failure cannot fail open.

## Activation boundary

This ADR and its source foundation do not make moderation ready. All of the
following remain unchanged and mandatory:

- `POST_MODERATION_READY` stays hard-coded `false`.
- Runtime enablement remains an AND-mask with the source readiness latch.
- Preflight continues to reject attempted moderation activation while the
  source latch is closed.
- The production singleton continues to use the legacy authenticator, which is
  rejected by the strict workforce authorizer.
- Existing moderation activation configuration is not relaxed to `legacy OR
  OIDC`.
- No provider/JWKS/role environment variables, database migration, reviewer
  account, Railway deployment, claim, decision, or content removal is created
  by this change.

## Alternatives considered

- **Keep static reviewer keys:** rejected because they lack individual session,
  MFA, role, and offboarding guarantees.
- **Trust provider roles as capabilities:** rejected because provider
  administration would directly control irreversible EasyGo actions.
- **Use a process-local token bucket:** rejected because state diverges and
  resets across processes and deploys.
- **Use IP or `X-Forwarded-For`:** rejected because it is not the authenticated
  reviewer and proxy trust is not the authorization boundary.
- **Fail open when the store is unavailable:** rejected because moderation
  actions are high impact and the source must prefer bounded unavailability.

## Consequences

The code can be tested with local asymmetric keys and injected access/rate
adapters before a provider or persistence technology is activated. The extra
interfaces and fail-closed defaults add implementation steps, but keep identity
verification, authorization policy, rate storage, and deployment approvals
independently reviewable.

## Required follow-up approvals

1. [ ] Product, Backend, Security, Privacy/Legal, and Operations accept this ADR.
2. [ ] Select the workforce provider, dedicated audience/token type, MFA claim
   semantics, and pinned JWKS endpoint.
3. [ ] Approve provisioned access storage, subject protection, offboarding,
   access review, and break-glass procedures.
4. [ ] Approve GCRA thresholds, PostgreSQL schema/migration, cleanup, backup,
   restore, and rollback plan.
5. [ ] Implement and test the provider configuration parser, access resolver,
   and PostgreSQL rate consumer without changing the source latch.
6. [ ] Complete independent security review and the remaining ADR-0011 device,
   safe-UGC, legal, observability, and rollback evidence.
7. [ ] Use a later explicit approval to change singleton wiring, deployment
   configuration, migrations, or activation state.
