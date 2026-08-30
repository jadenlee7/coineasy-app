# ADR-0014: Select one approved moderation operating policy before wiring

**Status:** Proposed
**Date:** 2026-08-28
**Deciders:** Product, Backend, Security, Privacy/Legal, and Operations

## Context

[ADR-0011](./0011-protected-post-report-moderation.md) defines the protected
post-report queue. [ADR-0012](./0012-workforce-oidc-and-actor-rate-limits.md)
defines provider-neutral workforce OIDC, RBAC, and actor-rate contracts.
[ADR-0013](./0013-postgresql-gcra-moderation-rate-limits.md) defines the dormant
PostgreSQL GCRA foundation.

The reviewed source now contains the security boundaries needed to test those
contracts, but it intentionally does not contain the operational choices needed
to authorize a reviewer. Scattering those choices across environment variables,
provider roles, database defaults, or deployment notes could create an
apparently complete configuration without one accountable approval.

This ADR is the decision packet for those choices. It records the available
options, the selected workforce-authentication architecture direction, the
remaining exact values and owners that must be approved, and the evidence
required before production wiring. It does not treat an architecture direction
as a configured provider, approve a placeholder, provision a provider or
reviewer, apply a migration, deploy a release, change a singleton, or open
either gate.

The concrete values currently proposed for review are collected in the
[Workspace OIDC and WebAuthn policy approval packet](../MODERATION_WORKSPACE_WEBAUTHN_POLICY_APPROVAL_PACKET.md).
That packet is a candidate matrix only. Its creation, review, approval as a PR,
or merge does not select a value, satisfy this ADR's joint operating approval,
or authorize implementation or activation.

## Current implementation receipt

| Foundation | Merged source receipt | Operational meaning |
| --- | --- | --- |
| RBAC principal and authorization | PR #67, merge `3d18f78698341e75a26684c5d550a7c8db4d085a` | Contract only; no workforce is provisioned |
| Provider-neutral OIDC and actor-rate middleware | PR #68, merge `8a86886376c3f334c94f292eaf9f492c770adc9e` | Testable bearer verifier only; selected Google/session/WebAuthn profile is not implemented or provisioned |
| PostgreSQL GCRA foundation | PR #69, merge `7acef194f032c05a6370346bea3a367101a01407` | Source schema, migration, consumer, and tests; target application is not proven |
| Combined readiness foundation | PR #70, merge `c24340becfb7eb06eb5f56a1a771dd0c65edf349` | Queue and rate contracts are a strict AND; activation remains closed |
| Dormant runtime composition | PR #71, merge `656da12932ca4f5dd71eab651cf0831e410f1edb` | Injected auth, authorization, and rate seams interoperate; production does not import them |

These receipts do not establish a Railway deployment, target migration, target
catalog state, approved policy, reviewer account, or real moderation action.
The source still hard-codes `POST_MODERATION_READY=false`; runtime enablement
remains masked off; the production singleton still uses the legacy candidate
authentication path and an unconfigured actor limiter.

## Decision

Select Google Workspace identity bootstrap plus an EasyGo-owned opaque session
and user-verifying WebAuthn step-up as the workforce-authentication architecture
direction. Specifically:

1. Google Workspace is the workforce identity source, with `coineasy.xyz` as
   the user-confirmed hosted-domain planning input. This is not provider-side
   verification that the domain, OAuth project, or Workspace security policy is
   configured.
2. A dedicated Google OAuth/OIDC application bootstraps identity through a
   server-side authorization-code flow with PKCE. Exact signed-token validation
   and the immutable `(issuer, sub)` pair establish identity; `email`, display
   name, domain text in email, and Google groups never become request-time
   EasyGo capabilities.
3. An EasyGo-owned PostgreSQL access registry resolves the identity to an
   active opaque `wf_...` actor and exact capabilities, then issues a constrained
   bootstrap session. Successful initial/general user-verifying WebAuthn
   authentication rotates it to a revocable opaque operator session. Google
   ID/access tokens and the bootstrap session are not moderation API bearer
   credentials.
4. Every `REMOVE_POST` requires a user-verifying WebAuthn ceremony whose
   server-side result is action-bound, one-time, and at most 900 seconds old at
   commit. Optional Google `auth_time` or `amr` claims cannot replace that
   proof.

This is a selected architecture direction, not a complete operating policy. Do
not create an activation-capable singleton until one versioned operating policy
has all of the following sections selected and approved together:

1. workforce identity provider and exact token/MFA profile;
2. server-owned access registry and role-to-capability policy;
3. per-scope GCRA thresholds and policy-transition procedure;
4. data-class-specific retention, cleanup, legal-hold, backup, and restore
   policy; and
5. named operations, security, privacy/legal, contact, appeal, and on-call
   ownership.

`MODERATION_POLICY_VERSION` and `MODERATION_RETENTION_POLICY_VERSION` must point
to approved immutable records covering those selections. A missing value,
placeholder, undocumented change, or approval from only one discipline is a
stop condition. Source safety bounds are constraints, not approved production
defaults.

Only the direction explicitly recorded above is selected by this Proposed ADR.
Every field marked `Unselected`, including the exact provider, session,
WebAuthn, rate, retention, and operating values, remains a stop condition until
the named deciders provide evidence and approval.

## Workforce identity options

### Option A: Google Workspace bootstrap plus EasyGo session and WebAuthn

**Selected architecture direction.** Use the existing Google Workspace account
lifecycle for identity bootstrap, then keep the moderation session,
authorization, recent step-up, and immediate revocation inside EasyGo.

**Pros:** reuses the existing workforce directory, keeps irreversible EasyGo
authorization server-owned, uses the existing PostgreSQL operating surface, and
does not require a second identity tenant for the first design.

**Cons:** EasyGo must implement and operate an opaque session plus WebAuthn
credential/challenge lifecycle. Google optional `auth_time`/`amr` claims do not
provide the action-bound guarantee, and exact OAuth/domain policy still needs
proof.

### Option B: Dedicated managed identity broker or workforce tenant

**Fallback for evaluation.** A managed broker such as Auth0 can federate Google
Workspace and operate more of the MFA/session lifecycle if its exact token,
step-up, revocation, offboarding, and audit semantics pass the same contract.

**Pros:** isolates reviewer policy, audience, roles, and emergency revocation.

**Cons:** adds vendor administration, cost, recovery, and a second lifecycle to
operate.

### Option C: Google IAP or another managed access proxy

**Deferred.** A browser access proxy can add a strong perimeter, but EasyGo
still needs request-time RBAC, action-bound WebAuthn evidence, audit, and origin
protection. Google IAP for a non-GCP Railway origin also adds a Google Cloud load
balancer and origin-bypass controls. It is not selected by this ADR.

### Option D: Cloudflare Access in front of Railway

**Deferred.** Cloudflare Access can federate Google Workspace and enforce its
own MFA, but adopting it requires a separately approved DNS/edge and direct
origin-protection design. It does not replace EasyGo's local authorization or
destructive-action proof.

### Option E: Purpose-built self-managed workforce issuer

**Eligible for evaluation, not selected.** A purpose-built issuer could satisfy
ADR-0012, but only with independently reviewed workforce lifecycle, mandatory
MFA evidence, asymmetric-key custody and rotation, revocation, availability,
incident response, and disaster recovery. Its operational and security burden
must be compared with the managed options rather than assumed away.

### Option F: EasyGo consumer identity, shared key, or direct token grants

**Rejected.** Privy application users, shared `eg_mod_...` keys, provider roles
used directly as capabilities, and token-supplied grants do not establish the
required workforce lifecycle, MFA, least privilege, or bounded recovery.

### Required identity selection

| Field | Selected direction / remaining approval |
| --- | --- |
| Architecture direction | Google Workspace identity bootstrap, followed by an EasyGo opaque server session and user-verifying WebAuthn step-up |
| Hosted-domain planning candidate | `coineasy.xyz`; exact signed provider claim and provider-side evidence Unselected |
| Provider/tenant owner and provider-side domain evidence | Unselected |
| Google Cloud project and dedicated OAuth client owner | Unselected |
| Exact issuer acceptance rule | Unselected |
| Dedicated OAuth client ID/audience | Unselected |
| Exact server redirect URI and browser origin | Unselected |
| Exact token/header type policy | Unselected; do not require an optional Google header without provider proof |
| Allowed algorithm subset | Unselected |
| Pinned HTTPS JWKS URL | Unselected |
| Required bootstrap validation | Exact approved signature, issuer, audience, `sub`, provider-proven `hd`, `exp`, `iat`, state, and nonce; disposable-provider evidence remains Unselected |
| Google `auth_time`, `amr`, email, and groups | Not destructive proof or request-time capabilities; any risk/provisioning use remains Unselected |
| Provider-group reconciliation profile | Unselected; local RBAC remains authoritative |
| Maximum Google bootstrap age and EasyGo session age | Unselected; EasyGo session cannot exceed ADR-0012's eight-hour ceiling |
| Maximum general WebAuthn step-up age | Unselected; destructive removal is separately capped at 900 seconds |
| Reviewer provisioning and offboarding SLA | Unselected |
| Recovery and IdP break-glass owner | Unselected |

`coineasy.xyz` is recorded only as a user-confirmed domain identity for planning.
It is not evidence that the domain is verified in the selected Google Cloud
project, that a dedicated OAuth client exists, or that a Workspace MFA policy
is enforced. The login UI may use `hd` as a hint, but the server must require an
exact provider-proven hosted-domain claim; the current candidate cannot become
an accepted value without that evidence. The stable lookup key is `(issuer,
sub)`, never email.

## EasyGo session and WebAuthn step-up contract

The selected direction uses a composite EasyGo operator session rather than
passing a Google token through to moderation routes:

```text
Google authorization-code bootstrap with PKCE
  -> exact server-side ID-token and domain validation
  -> active `(issuer, sub)` access lookup
  -> constrained bootstrap session with no moderation capability
  -> user-verifying WebAuthn authentication
  -> revoke bootstrap/prior session and issue opaque operator session
  -> capability authorization
  -> additional action-bound WebAuthn step-up for every `REMOVE_POST`
  -> create one-time action grant bound to the unchanged operator session
  -> opaque-actor GCRA
  -> moderation-service transaction: atomic active/session/grant/version
     recheck, grant consume, removal, and audit
```

| Field | Selected direction / remaining approval |
| --- | --- |
| Session architecture | PostgreSQL-backed opaque bootstrap and operator sessions with atomic rotation/revocation; exact schema and owner Unselected |
| Bootstrap-session authority | WebAuthn enrollment/authentication and logout only; no moderation capability |
| API request credential | Opaque operator session only; never a Google token or bootstrap session |
| Session identifier at rest and in logs | Store a keyed digest, never the raw identifier; key/rotation design Unselected; log neither value |
| Browser credential handling | `Secure`, `HttpOnly`, appropriately `SameSite` cookie; exact host, path, expiry, rotation, and CSRF profile Unselected |
| Request-time access state | Active local access record required on every request; exact cache policy Unselected |
| General operator elevation | User presence and `UV=true` required; success uses the database clock and atomically rotates the session |
| General step-up age | Unselected; cannot exceed ADR-0012's eight-hour ceiling |
| Destructive step-up | Additional action-bound user-verifying WebAuthn required for every `REMOVE_POST` |
| Destructive proof age | At most 900 seconds at commit; an exact shorter bound may be selected |
| Destructive session behavior | Do not rotate the operator session; issue one action grant bound to that still-current session |
| Challenge binding | Current session, opaque actor, report ID, expected report version, expected post revision, and `REMOVE_POST` intent |
| Challenge entropy, TTL, storage, and atomic consume | Required; exact values/schema Unselected |
| Exact RP ID and allowed origins | Unselected |
| User verification | Required; signed assertion must have `UV=true` |
| Allowed credential algorithms and transports | Unselected |
| Attestation and authenticator policy | Unselected |
| First registration and additional-credential approval | Unselected; requires a pre-provisioned active actor and named independent approver |
| Lost-device recovery and credential revocation | Unselected; recovery must revoke affected sessions, grants, and unused challenges before replacement |

The 900-second value is a ceiling on EasyGo's server-recorded, successfully
verified action grant, not a WebAuthn assertion lifetime. The challenge and
assertion create one grant; the action transaction consumes that grant once.
Session refresh, Google reauthentication, or a second request cannot reuse or
refresh them. A signature counter decrease is a risk signal, not proof by
itself; replay safety depends on the one-time bound challenge and transactional
consume.

Successful general operator elevation must create a new session with
server-database times satisfying `issuedAt >= mfaAuthenticatedAt` and revoke the
old session in the same transaction. A destructive action-bound ceremony keeps
that current operator session and creates only its bound one-time grant. No
implementation may make the current bearer-only OIDC middleware accept Google
tokens by copying `iat` into MFA time or by trusting a client-provided
`mfaVerified` value. The future singleton uses one exact opaque-session path
with no `OIDC OR session` or legacy fallback.

The destructive commit transaction must lock and recheck the actor's active
access record, the non-revoked current session, the unused bound action grant,
report ownership/version, and post revision; consume the grant; mutate the
report/post; and append the audit atomically. If a local deny or revocation
committed first, the action fails closed. This closes the offboarding race after
an earlier request-time access check.

Offboarding is local-first: commit the EasyGo deny, revoke every local session,
step-up grant, credential, and unused challenge, then suspend/sign out the
Workspace account, revoke provider tokens where applicable, and remove groups.
Provider propagation is defense in depth, not the immediate deny boundary.

## Access registry options

### Option A: Provisioned PostgreSQL allowlist

**Selected architecture direction.** Match an exact issuer plus protected
immutable subject lookup, store a random stable opaque `wf_...` actor ID, and
map approved local access records through a server-owned exact capability
allowlist.

This option still requires an approved subject-protection and key-rotation
design, additive schema, least-privilege role, access-review workflow, backup
policy, and offboarding behavior before implementation.

### Option B: Live external workforce-directory resolver

**Viable only** when the directory has bounded availability, immutable subject
semantics, explicit revocation, and a reviewed cache-invalidation contract.
Directory outage must fail closed as unavailable rather than reuse stale grants.

### Option C: Token roles as capabilities or a static configuration fallback

**Rejected.** There is no wildcard, default grant, email/name identity key,
token-supplied capability, unknown-user grant, or `legacy OR OIDC` fallback.

### Required access selection

| Field | Selected direction / remaining approval |
| --- | --- |
| Registry option and system owner | Provisioned PostgreSQL allowlist selected; system owner Unselected |
| Subject protection and rotation method | Unselected |
| Stable actor-ID issuance and collision procedure | Unselected |
| Google-group reconciliation and actor-to-capability mapping | Group input use Unselected; exact server-owned actor-to-capability mapping Unselected |
| Provisioning approver | Unselected |
| Offboarding order | Local deny and session/credential/grant/challenge revocation first; exact deadline and cache invalidation Unselected |
| Periodic access-review cadence | Unselected |
| Access break-glass procedure and independent approver | Unselected |
| Registry retention, backup, and restore policy | Unselected |

## Rate-policy options

### Option A: Risk-differentiated four-scope policy

**Recommended.** Select separate emission intervals and burst capacities for
`queue.read`, `report.claim`, `report.decide`, and `content.remove`. Removal
continues to consume both decision and removal scopes atomically.

### Option B: One uniform policy for every scope

**Not recommended without measured justification.** It is simpler, but either
under-protects destructive actions or makes ordinary queue reads unnecessarily
unavailable.

### Option C: Edge/IP rate limit only

**Rejected.** Managed edge protection may supplement the service, but it does
not identify the authenticated reviewer and cannot replace opaque-actor GCRA.

### Required rate selection

| Scope | `emissionIntervalMs` | `burstCapacity` | Evidence/approver |
| --- | --- | --- | --- |
| `queue.read` | Unselected | Unselected | Unselected |
| `report.claim` | Unselected | Unselected | Unselected |
| `report.decide` | Unselected | Unselected | Unselected |
| `content.remove` | Unselected | Unselected | Unselected |

The packet must also select one non-placeholder policy version, the maximum
full-debt drain horizon, version/fingerprint transition procedure, staging
concurrency/load evidence, alert threshold, and rollback behavior. Every value
must remain inside ADR-0013's source safety bounds. This ADR intentionally does
not invent traffic assumptions or production numbers.

## Retention options

### Option A: Data-class-specific bounded retention plus audited legal hold

**Recommended.** Approve separate maximum retention windows, deletion deadlines,
and purge rules for access records, expired GCRA rows, reports/audits,
operational logs, and backups. Legal hold is explicit, access-controlled,
time-bounded, independently audited, and has an approved release procedure.

### Option B: One uniform retention period

**Not recommended without legal justification.** The data classes have
different operational, appeal, security, and privacy purposes.

### Option C: Indefinite retention or manual ad-hoc deletion

**Rejected.** It creates unnecessary workforce/user metadata accumulation and
an unauditable destructive path.

### Required retention selection

| Data class | Maximum retention/TTL | Deletion deadline and purge | Legal-hold approval/release | Owner |
| --- | --- | --- | --- | --- |
| Workforce access registry | Unselected | Unselected | Unselected | Unselected |
| OIDC state/nonce and privacy-minimized bootstrap receipts | Unselected | Unselected | Unselected | Unselected |
| Opaque sessions and rotation/revocation metadata | Unselected | Unselected | Unselected | Unselected |
| WebAuthn credential public data, challenges, and assurance receipts | Unselected | Unselected | Unselected | Unselected |
| Expired GCRA bucket rows | Unselected | Unselected | Unselected | Unselected |
| `PostReport` and moderation audit | Unselected | Unselected | Unselected | Unselected |
| Logs, alerts, and privacy-minimized observability | Unselected | Unselected | Unselected | Unselected |
| Encrypted database backups | Unselected | Unselected | Unselected | Unselected |

The approved policy must also cover reporter deletion, hard `Post` or
`PostReport` deletion, appeal evidence, restored stale-backup rate debt, cleanup
batch size/schedule, monitoring, and proof that an active future GCRA TAT is
never deleted.

## Operating ownership selection

| Responsibility | Approved owner and evidence |
| --- | --- |
| Google Cloud project, OAuth client, and Workspace policy | Unselected |
| Opaque-session incident response and mass revocation | Unselected |
| WebAuthn enrollment, recovery, and credential revocation | Unselected |
| Primary moderation queue and coverage schedule | Unselected |
| Backup/on-call reviewer and handoff | Unselected |
| Security/auth escalation | Unselected |
| Privacy/Legal and urgent-content escalation | Unselected |
| User contact templates, sender, and channel | Unselected |
| Appeal intake, independent reviewer, and deadline | Unselected |
| Response SLA, alert destination, and breach procedure | Unselected |
| Abuse monitoring for the per-post pending bound | Unselected |

## Approval and activation sequence

1. Product, Backend, Security, Privacy/Legal, Operations, and a named moderation
   owner jointly ratify one immutable candidate-packet version as suitable only
   for non-production proof. Ratification requires named proof owners but does
   not approve an operating value, configure a provider, or execute the proof.
2. Under a separate provider-proof approval, provision only a dedicated
   non-production Google OAuth client and disposable WebAuthn test origin.
   Capture exact issuer/audience/JWKS/header/claim behavior, domain ownership,
   redirect/origin/RP behavior, and value-safe receipts. Do not provision a real
   reviewer or connect the proof to the production singleton.
3. Product, Backend, Security, Privacy/Legal, Operations, and the named
   moderation owner review those receipts and jointly accept ADR-0011,
   ADR-0012, ADR-0013, this ADR, and every final exact Google, session,
   WebAuthn, access, rate, retention, ownership, and recovery value. A failed
   proof, unselected stop, missing human owner, or changed candidate starts a
   new ratification and proof cycle.
4. On a new source-latch-off branch, implement the Google bootstrap adapter,
   constrained bootstrap session, opaque operator-session rotation/revocation,
   WebAuthn credential/challenge stores, and access resolver. There is no Google
   bearer path, OIDC/session OR fallback, legacy fallback, import-time I/O,
   migration application, singleton change, or gate change.
5. Complete independent security review, browser/session tests, and
   disposable-PostgreSQL CI. Prove state/nonce and CSRF rejection, bootstrap
   session confinement, session fixation resistance, exact origin/RP/UP/UV and
   signature checks, 900-second acceptance plus 901-second rejection,
   action/revision binding, replay and concurrent-replay rejection, atomic old
   session revocation, offboarding denial, privacy-minimized logs, and recovery
   fail-closed behavior.
6. Under separate explicit approvals, use only the existing approved staging
   target to provision disposable workforce identities and access records,
   capture encrypted backup/restore and target identity receipts, drain traffic,
   and apply only the approved pending staging migration. Do not create another
   service or infer a production target from staging.
7. Under a separate source-change approval, replace the production singleton
   and change the source readiness latch while the Railway runtime flag remains
   false. Run full review, disposable-PostgreSQL tests, mobile checks, and CI on
   that exact activation-capable SHA. This source change is not deployment or
   runtime activation.
8. Under a separate deployment approval, deploy that exact SHA to the approved
   staging target with the Railway runtime flag still false. Prove gate-off
   isolation, health, release identity, log privacy, and rollback without a
   moderation request reaching OIDC, access, GCRA, or service dependencies.
9. Under a separate controlled-staging-QA approval, enable only the isolated
   staging runtime flag with disposable identities and synthetic data. Verify
   OIDC bootstrap, opaque sessions, WebAuthn, access, GCRA, exact catalog
   contracts, privacy, concurrency, failure codes, audit receipts, and rollback
   on the same SHA; then close the flag, monitor, and promote that exact release
   as the minimum safe rollback floor.
10. Complete device, safe-UGC, legal, access-review, offboarding, retention,
   contact, appeal, monitoring, and on-call exercises. Under a separate
   production-target approval, resolve or provision the exact production
   project, environment, services, and database; capture value-safe identity,
   backup/restore, migration, and configuration receipts; deploy the same
   staging-qualified SHA with the production runtime flag false; then verify
   release, catalog, privacy, health, monitoring, and rollback evidence. An
   absent or unverified production target is a stop condition, never staging.
11. Under a final separate approval, enable the verified production runtime
   flag. The first real moderation action requires an exact committed audit
   receipt.

No earlier step authorizes a later one. A source merge, CI pass, migration file,
successful deployment, healthy readiness endpoint, or configured environment
value alone is not activation evidence.

## Consequences

- Provider, authorization, rate, retention, and ownership choices become one
  reviewable operating contract instead of unrelated runtime knobs.
- Google Workspace avoids a second workforce tenant, while EasyGo accepts the
  operational burden of its own session, WebAuthn enrollment/recovery, and
  immediate-revocation lifecycle.
- Concrete adapter work pauses until accountable owners supply exact values.
- Activation takes more approvals, but no single partial configuration can
  silently complete a high-impact moderation trust boundary.
- If EasyGo cannot safely operate first credential registration, recovery, and
  mass revocation, the managed-broker option must be reconsidered before source
  wiring.
- If Google cannot prove the required immutable identity bootstrap semantics,
  EasyGo must select another workforce option rather than weaken the contract.

## Action items

1. [x] Record the Google Workspace bootstrap plus EasyGo opaque-session and
   WebAuthn architecture direction. This is a documentation receipt only.
2. [x] Publish one non-binding candidate packet that keeps proposed values,
   external evidence, named owners, and later approval gates distinct.
3. [ ] Jointly ratify one candidate version for a separately approved
   non-production proof.
4. [ ] Capture the separately approved external proof and jointly accept every
   final exact Google bootstrap field.
5. [ ] Select and jointly approve every opaque-session, WebAuthn enrollment,
   recovery, revocation, and break-glass field.
6. [ ] Select and approve every access-registry field.
7. [ ] Select and approve all four rate policies and transition evidence.
8. [ ] Select and approve every retention and legal-hold field, including OIDC,
   session, and WebAuthn data.
9. [ ] Name every operating owner and approve the SLA/escalation procedures.
10. [ ] Keep `POST_MODERATION_READY=false`, `POST_MODERATION_ENABLED=false`, the
   production singleton, environment surface, schema, and target state
   unchanged until their separately approved sequence step.

## References

- [EasyGo Workspace OIDC and WebAuthn policy approval packet](../MODERATION_WORKSPACE_WEBAUTHN_POLICY_APPROVAL_PACKET.md)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
  for server flow, state/nonce, signed-token validation, immutable `sub`, and
  Workspace `hd` validation.
- [Google Identity security bundle](https://developers.google.com/identity/siwg/security-bundle)
  for the optional and context-dependent `auth_time` and `amr` signals.
- [Google Workspace users.signOut](https://developers.google.com/workspace/admin/directory/reference/rest/v1/users/signOut)
  as a provider-side offboarding control that supplements the immediate EasyGo
  local deny and session revocation.
- [Web Authentication Level 3](https://www.w3.org/TR/webauthn-3/) for challenge,
  origin, RP ID, signature, user-presence, and user-verification checks.
- [Google IAP reauthentication](https://cloud.google.com/iap/docs/configuring-reauth),
  [Auth0 step-up authentication](https://auth0.com/docs/secure/multi-factor-authentication/step-up-authentication/configure-step-up-authentication-for-web-apps),
  and [Cloudflare Access with Google Workspace](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google-workspace/)
  as deferred alternatives requiring their own exact operating proof.
