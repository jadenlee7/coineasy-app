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
options, the recommended direction, the exact values and owners that must be
approved, and the evidence required before production wiring. It does not make
an unfilled choice, approve a placeholder, provision a provider or reviewer,
apply a migration, deploy a release, change a singleton, or open either gate.

## Current implementation receipt

| Foundation | Merged source receipt | Operational meaning |
| --- | --- | --- |
| RBAC principal and authorization | PR #67, merge `3d18f78698341e75a26684c5d550a7c8db4d085a` | Contract only; no workforce is provisioned |
| Provider-neutral OIDC and actor-rate middleware | PR #68, merge `8a86886376c3f334c94f292eaf9f492c770adc9e` | Testable verifier and middleware; no IdP selected |
| PostgreSQL GCRA foundation | PR #69, merge `7acef194f032c05a6370346bea3a367101a01407` | Source schema, migration, consumer, and tests; target application is not proven |
| Combined readiness foundation | PR #70, merge `c24340becfb7eb06eb5f56a1a771dd0c65edf349` | Queue and rate contracts are a strict AND; activation remains closed |
| Dormant runtime composition | PR #71, merge `656da12932ca4f5dd71eab651cf0831e410f1edb` | Injected auth, authorization, and rate seams interoperate; production does not import them |

These receipts do not establish a Railway deployment, target migration, target
catalog state, approved policy, reviewer account, or real moderation action.
The source still hard-codes `POST_MODERATION_READY=false`; runtime enablement
remains masked off; the production singleton still uses the legacy candidate
authentication path and an unconfigured actor limiter.

## Decision

Do not create an activation-capable singleton until one versioned operating
policy has all of the following sections selected and approved together:

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

No concrete selection is accepted by this Proposed ADR. The tables below remain
`Unselected` until the named deciders provide exact values and evidence.

## Workforce identity options

### Option A: Existing organization IdP with a dedicated moderation OIDC app

**Recommended when** the organization already has managed workforce accounts,
mandatory MFA, individual offboarding, access reviews, and exact signed claims
compatible with ADR-0012.

**Pros:** reuses an established employee lifecycle and reduces another tenant.

**Cons:** the existing tenant may not expose sufficiently strict `acr`, `amr`,
immutable subject, token type, or dedicated audience semantics.

### Option B: Dedicated managed workforce identity tenant

**Recommended fallback** when the existing organization IdP cannot satisfy the
contract without consumer-user or broad organization trust.

**Pros:** isolates reviewer policy, audience, roles, and emergency revocation.

**Cons:** adds vendor administration, cost, recovery, and a second lifecycle to
operate.

### Option C: Purpose-built self-managed workforce issuer

**Eligible for evaluation, not selected.** A purpose-built issuer could satisfy
ADR-0012, but only with independently reviewed workforce lifecycle, mandatory
MFA evidence, asymmetric-key custody and rotation, revocation, availability,
incident response, and disaster recovery. Its operational and security burden
must be compared with the managed options rather than assumed away.

### Option D: EasyGo consumer identity, shared key, or direct token grants

**Rejected.** Privy application users, shared `eg_mod_...` keys, provider roles
used directly as capabilities, and token-supplied grants do not establish the
required workforce lifecycle, MFA, least privilege, or bounded recovery.

### Required identity selection

| Field | Approved value |
| --- | --- |
| Option and provider/tenant owner | Unselected |
| Exact HTTPS issuer | Unselected |
| Dedicated audience | Unselected |
| Exact token type | Unselected |
| Allowed algorithm subset | Unselected |
| Pinned HTTPS JWKS URL | Unselected |
| Accepted MFA `acr` values | Unselected |
| Complete required MFA `amr` set | Unselected |
| Role claim name | Unselected |
| Maximum token/session age | Unselected |
| Maximum general MFA age | Unselected |
| Reviewer provisioning and offboarding SLA | Unselected |
| Recovery and IdP break-glass owner | Unselected |

## Access registry options

### Option A: Provisioned PostgreSQL allowlist

**Recommended candidate.** Match an exact issuer plus protected immutable
subject lookup, store a random stable opaque `wf_...` actor ID, and map approved
provider roles through a server-owned exact capability allowlist.

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

| Field | Approved value |
| --- | --- |
| Registry option and system owner | Unselected |
| Subject protection and rotation method | Unselected |
| Stable actor-ID issuance and collision procedure | Unselected |
| Exact provider-role to capability mapping | Unselected |
| Provisioning approver | Unselected |
| Offboarding deadline and cache invalidation | Unselected |
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
   owner approve ADR-0011, ADR-0012, ADR-0013, this ADR, and every exact value
   above.
2. On a new source-latch-off branch, implement the provider parser and access
   resolver with no legacy fallback, import-time I/O, or singleton change.
3. Complete independent security review and disposable-PostgreSQL CI.
4. Under separate explicit approvals, use only the existing approved staging
   target to provision disposable workforce identities and access records,
   capture encrypted backup/restore and target identity receipts, drain traffic,
   and apply only the approved pending staging migration. Do not create another
   service or infer a production target from staging.
5. Under a separate source-change approval, replace the production singleton
   and change the source readiness latch while the Railway runtime flag remains
   false. Run full review, disposable-PostgreSQL tests, mobile checks, and CI on
   that exact activation-capable SHA. This source change is not deployment or
   runtime activation.
6. Under a separate deployment approval, deploy that exact SHA to the approved
   staging target with the Railway runtime flag still false. Prove gate-off
   isolation, health, release identity, log privacy, and rollback without a
   moderation request reaching OIDC, access, GCRA, or service dependencies.
7. Under a separate controlled-staging-QA approval, enable only the isolated
   staging runtime flag with disposable identities and synthetic data. Verify
   OIDC, access, GCRA, exact catalog contracts, privacy, concurrency, failure
   codes, audit receipts, and rollback on the same SHA; then close the flag,
   monitor, and promote that exact release as the minimum safe rollback floor.
8. Complete device, safe-UGC, legal, access-review, offboarding, retention,
   contact, appeal, monitoring, and on-call exercises. Under a separate
   production-target approval, resolve or provision the exact production
   project, environment, services, and database; capture value-safe identity,
   backup/restore, migration, and configuration receipts; deploy the same
   staging-qualified SHA with the production runtime flag false; then verify
   release, catalog, privacy, health, monitoring, and rollback evidence. An
   absent or unverified production target is a stop condition, never staging.
9. Under a final separate approval, enable the verified production runtime
   flag. The first real moderation action requires an exact committed audit
   receipt.

No earlier step authorizes a later one. A source merge, CI pass, migration file,
successful deployment, healthy readiness endpoint, or configured environment
value alone is not activation evidence.

## Consequences

- Provider, authorization, rate, retention, and ownership choices become one
  reviewable operating contract instead of unrelated runtime knobs.
- Concrete adapter work pauses until accountable owners supply exact values.
- Activation takes more approvals, but no single partial configuration can
  silently complete a high-impact moderation trust boundary.
- If a selected provider cannot prove the required immutable identity and MFA
  semantics, EasyGo must select another workforce option rather than weaken the
  existing contract.

## Action items

1. [ ] Select and approve every identity field.
2. [ ] Select and approve every access-registry field.
3. [ ] Select and approve all four rate policies and transition evidence.
4. [ ] Select and approve every retention and legal-hold field.
5. [ ] Name every operating owner and approve the SLA/escalation procedures.
6. [ ] Keep `POST_MODERATION_READY=false`, `POST_MODERATION_ENABLED=false`, the
   production singleton, environment surface, schema, and target state
   unchanged until their separately approved sequence step.
