# ADR-0012: Verify workforce OIDC and rate-limit moderation by opaque actor

**Status:** Proposed
**Date:** 2026-08-27
**Updated:** 2026-08-28
**Owners:** Product, Backend, Security, Privacy/Legal, Operations

## Context

[ADR-0011](./0011-protected-post-report-moderation.md) requires the post-report
moderation surface to use a separate workforce trust domain. The current source
candidate still has a legacy hashed-key authenticator, and the strict workforce
principal deliberately rejects that identity at the authorization boundary.
The production singleton also has no wired shared operator rate-limit store.

Static reviewer keys do not provide session expiry, recent MFA evidence,
individual offboarding, or server-owned role assignment. IP-based limits are
also unsuitable for this surface: several reviewers can share an egress IP,
proxy headers are not an authenticated actor identity, and a process-local map
would reset or diverge across Railway replicas.

This ADR defines a dormant, provider-neutral foundation. ADR-0014 now selects a
Google Workspace identity-bootstrap plus EasyGo WebAuthn direction for later
implementation, but the exact Google and WebAuthn profiles remain unselected.
This source does not provision a reviewer, add Railway variables, create or
apply a database migration, replace the production singleton authenticator,
deploy, or open the source activation latch.

## Dormant source decision, not the selected Google activation contract

The merged provider-neutral source foundation uses the following stages for
isolated testing. ADR-0014 supersedes its bearer-token authentication path for
the selected Google activation direction. The verifier and middleware remain a
source receipt; they must not be wired to Google ID tokens or retained as an
`OIDC OR session` fallback. The RBAC, recent-auth bound, actor limiter, and
fail-closed ordering remain reusable behind the future opaque-session
authenticator.

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

The dormant source composition order is fixed:

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

## Selected Google Workspace and WebAuthn direction

ADR-0014 selects the following architecture direction for a future dormant
implementation. It does not assert that the Google tenant, OAuth client,
Workspace MFA policy, WebAuthn relying party, or reviewer lifecycle is already
configured or verified.

1. Google Workspace is the workforce identity source. `coineasy.xyz` is a
   user-confirmed planning input; provider-side domain ownership and policy
   evidence remain required. A server-side Google authorization-code flow with
   PKCE must validate state and nonce plus the signed ID token's exact approved
   issuer, audience, expiry, issued-at time, and provider-proven hosted-domain
   claim. `coineasy.xyz` is the user-confirmed planning candidate, not
   provider-side proof. The immutable `(issuer, sub)` pair is the identity key.
   Email, display name, domain text in an email address, and Google groups are
   not request-time EasyGo capabilities.
2. The Google result bootstraps an EasyGo session only. A Google ID or access
   token is never the moderation API bearer, and optional Google `auth_time` or
   `amr` claims do not establish the destructive-action boundary. Google groups
   may later be an approved provisioning or reconciliation input, but the
   server-owned access registry is the final request-time authorization source.
3. After the exact `(issuer, sub)` resolves to an active access record, EasyGo
   issues only a high-entropy opaque bootstrap session backed by PostgreSQL.
   That session can reach only reviewed WebAuthn enrollment/authentication and
   logout endpoints; it carries no moderation capability. Browser JavaScript
   receives no Google or EasyGo bearer token.
4. Successful user-verifying WebAuthn authentication atomically consumes its
   challenge, revokes the bootstrap or prior session, and issues a new opaque
   operator session. EasyGo records `mfaAuthenticatedAt` from the server
   database clock and ensures the new session was issued at or after that time.
   The session cookie must be `Secure`, `HttpOnly`, appropriately `SameSite`,
   CSRF-protected, bounded by the existing eight-hour source ceiling,
   revocable, and checked against current access state on every request. The
   exact shorter lifetime remains an operating-policy decision.
5. Every `REMOVE_POST` additionally requires an action-bound user-verifying
   WebAuthn step-up. The server creates a cryptographically unpredictable,
   short-lived challenge and binds
   it to the current session, opaque actor, report ID, expected report version,
   expected post revision, and `REMOVE_POST` intent. It verifies the exact
   approved origin and RP ID, credential ownership, signature, user presence,
   and `UV=true`, then atomically consumes the challenge once and creates one
   server-side action grant bound to the still-current operator session. This
   destructive ceremony does not rotate that session. When the bound action
   commits, one database transaction must lock and recheck the active access
   record, non-revoked session, unused grant, report ownership/version, and post
   revision; consume the grant; mutate the report/post; and append the audit.
   The grant's verified time must be no more than 900 seconds old. A Google
   login, session refresh, assertion reuse, offboarded actor, or second request
   cannot refresh or reuse it.
6. Credential registration and recovery are separate privileged ceremonies.
   Only a pre-provisioned active actor may register, and first registration,
   replacement, and recovery require a named independent approver. Recovery or
   suspected compromise revokes existing credentials, sessions, step-up
   grants, and unused challenges before replacement.
7. Offboarding starts with a committed EasyGo local deny and revocation of all
   local sessions, step-up grants, credentials, and challenges. Workspace
   suspension, sign-out/token revocation, and group removal follow as defense in
   depth; their propagation is not the immediate authorization boundary. Once
   the local deny commits, the destructive-commit recheck prevents an in-flight
   request from committing afterward.

Privy consumer authentication remains a separate trust domain and cannot
bootstrap, recover, or authorize a moderation operator.

The current dormant verifier and middleware expect one bearer token to provide
OIDC identity and provider-adapted MFA together. They are not the selected
Google profile's activation implementation. A future source-latch-off change
must replace that request credential path with the reviewed opaque-session
authenticator; it cannot add `OIDC OR session`, copy Google `iat` into
`mfaAuthenticatedAt`, accept a client-supplied MFA boolean, or extend the old
session after WebAuthn. Capability authorization, the 900-second removal bound,
and opaque-actor GCRA remain reusable after a strict principal is constructed.

## Provider-neutral bearer verifier receipt

The following contract describes the dormant merged verifier, not the selected
Google request credential. The future Google bootstrap adapter may reuse strict
JWT and JWKS helpers only after its exact provider profile is approved; it must
not manufacture provider MFA evidence or expose the token to moderation routes.

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

## Provider-neutral access-resolution receipt

The resolver is server-owned and fail-closed. It must:

- match the exact issuer and immutable subject against a provisioned,
  non-offboarded workforce record;
- generate or retrieve a stable opaque actor ID matching `wf_...` without
  storing the raw provider subject in moderation audit records;
- map approved provider roles to only `queue.read`, `report.claim`,
  `report.decide`, `content.remove`, `audit.read`, and `access.admin`;
- provide no wildcard, default grant, token-supplied capability, email/name
  identity key, or fallback to the legacy static key authenticator.

For the selected Google direction, the bootstrap token does not supply
request-time roles. Any future Google-group reconciliation is a separately
approved provisioning input; the active local record and its exact
actor-to-capability mapping remain authoritative.

Google Workspace is the selected identity source, and a provisioned
PostgreSQL allowlist with opaque server sessions is the selected architecture
direction. The exact OAuth client and issuer profile, subject-protection
method, role mapping, session lifetime, offboarding SLA, access review,
WebAuthn profile, break-glass path, schema, and operational owners remain
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

ADR-0013's schema, additive migration, concrete GCRA consumer, and catalog
verifier now exist in merged source as a dormant foundation. That source
receipt is not evidence that the migration was applied to a target, that a
release was deployed, or that a rate policy was approved. Exact thresholds,
retention, cleanup, backup/restore evidence, target migration, and Railway
rollout remain separately approved work.

## Failure and privacy contract

| Condition | Result |
| --- | --- |
| Source/runtime gate off | `404 not_found`; no auth, JWKS, resolver, limiter, or service call |
| Missing, malformed, expired, wrong issuer/audience/type/MFA token | `401 invalid_moderation_identity` |
| Missing, expired, or revoked opaque bootstrap/operator session | `401 invalid_moderation_identity` |
| Valid identity not provisioned or missing a required capability | `403 moderation_forbidden` |
| Valid session without the required current WebAuthn proof | `403 moderation_forbidden` |
| Invalid OIDC/access configuration | `503 moderation_auth_unconfigured` |
| OIDC/JWKS/access/session/WebAuthn dependency outage | `503 moderation_auth_unavailable` |
| Missing rate-limit consumer | `503 moderation_rate_limit_unconfigured` |
| Rate-store outage or invalid result | `503 moderation_rate_limit_unavailable` |
| Actor bucket exhausted | `429 moderation_rate_limited` plus bounded integer `Retry-After` |

Responses and logs must not contain bearer tokens, provider subjects, claims,
role IDs, actor IDs, raw session identifiers or digests, OIDC state/nonce,
WebAuthn challenges or credential IDs, JWK/JWKS data, IP addresses, or provider
error messages. Outage logs contain only a fixed internal error classification,
never an arbitrary dependency-provided error name. Logger failure cannot fail
open.

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
- No Google Cloud project or OAuth client, redirect URI, WebAuthn RP ID/origin,
  WebAuthn credential, opaque-session or challenge schema, access record, or
  operator session is created by this documentation decision.
- No provider/JWKS/role environment variables, database migration, reviewer
  account, Railway deployment, claim, decision, or content removal is created
  by this change.

## Alternatives considered

- **Keep static reviewer keys:** rejected because they lack individual session,
  MFA, role, and offboarding guarantees.
- **Use Google ID tokens directly as moderation bearer tokens:** rejected
  because identity bootstrap is not a revocable EasyGo operator session or an
  action-bound recent WebAuthn proof.
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
2. [ ] Prove and approve the selected Google Workspace bootstrap profile,
   including the dedicated OAuth client, exact issuer/audience/JWKS behavior,
   redirect URI, domain evidence, and token-validation semantics.
3. [ ] Approve provisioned access storage, subject protection, offboarding,
   access review, opaque-session lifecycle, WebAuthn registration/recovery, and
   break-glass procedures.
4. [ ] Approve GCRA thresholds, target migration, cleanup, backup, restore, and
   rollback plan.
5. [x] Implement and test the provider-neutral OIDC, RBAC, PostgreSQL GCRA,
   readiness, and dormant runtime foundations without changing the source latch.
   PRs #67 through #71 are source and CI receipts only.
6. [ ] After ADR-0014 selects every remaining exact value, implement and test
   the Google bootstrap adapter, opaque-session and WebAuthn stores, provider
   configuration parser, and access resolver without changing the source latch
   or production singleton.
7. [ ] Complete independent security review and the remaining ADR-0011 device,
   safe-UGC, legal, observability, and rollback evidence.
8. [ ] Use a later explicit approval to change singleton wiring, deployment
   configuration, migrations, or activation state.
