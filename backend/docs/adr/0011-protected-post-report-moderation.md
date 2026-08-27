# ADR-0011: Protect post-report moderation with a separate reviewer trust domain

**Status:** Proposed
**Date:** 2026-08-26
**Deciders:** EasyGo Product, Backend, Security, Privacy/Legal, and the named
moderation owner (all approvals pending)

## Context

The deployed EasyGo ingest accepts an authenticated, allow-listed, idempotent
report for a non-owner post. The exact `69bf0bb` staging release passed
first-report, same reporter/post replay, invalid, self-report, deleted-post,
persistence, and cleanup smoke. That historical receipt proves only that
deployed ingest contract. A separate 2026-08-27 approval applied the additive
moderation expand migration and deployed exact `48bc35f` with both the source
and Railway gates false. That gate-off receipt proves migration/catalog
compatibility, route isolation, and stabilization only; it did not provision a
reviewer or exercise a moderation action. Neither surface provides an
activated protected queue, workforce reviewer ownership, response SLA,
escalation, user contact, appeal, or approved retention operation.

The deployed gate-off `PostReport` model has `OPEN`, `REVIEWING`, `ACTIONED`,
and `DISMISSED` states plus reviewer attribution, optimistic versions, bounded
decision codes, immutable content-revision identity, and append-only action
audit, but it lacks an activated workforce reviewer workflow. Mobile Hide,
Block, and Mute remain owner-scoped device controls; they are not global
content moderation.

EasyGo has three existing authentication domains, none of which is an
acceptable moderation identity:

- ordinary Privy bearer tokens authenticate EasyGo users;
- advertiser `eg_adv_...` keys authorize an active advertiser's own campaign
  surface; and
- `ADMIN_SECRET` authorizes the internal Orange ledger write endpoint.

Reusing any of those credentials would merge unrelated privileges, prevent
reliable reviewer attribution, and enlarge the impact of one leaked secret.
The current moderation-auth foundation candidate instead maps a stable opaque
reviewer key ID to the SHA-256 digest of a dedicated `eg_mod_...` bearer key in
`MODERATION_API_KEY_HASHES_JSON`. It validates every configured digest with
constant-time comparison and attaches only the opaque key ID to the request.
Raw keys are not stored in Git or application logs.

That hashed-key design is only an MVP foundation for isolated development or
separately approved staging validation. It does not provide workforce identity,
MFA, role-based authorization, employment offboarding, or recent-auth proof.
Workforce OIDC with MFA and explicit RBAC therefore remains a stop-ship gate for
activation and for claiming App Review Guideline 1.2 readiness.

This ADR describes the local source candidate and its review boundary. The
presence of code or additive migration SQL in a branch does not authorize a
database migration, deployment, Railway variable change, endpoint activation,
reviewer-key provisioning, content decision, App Store submission, or user
contact.

## Decision

### Trust boundary and activation gate

Create a separate `/moderation` authorization domain. Every route must be
hidden behind a default-off `POST_MODERATION_ENABLED=false` runtime gate and
must fail closed when its authentication configuration is absent or invalid.
Possession of `ADMIN_SECRET`, an advertiser key, or an ordinary Privy user token
must never satisfy moderation authentication.

The MVP auth candidate may recognize a dedicated per-reviewer `eg_mod_...`
key through its server-side SHA-256 digest and stable opaque key ID. Keys must
never be shared between reviewers. Authentication failure logs only a bounded
error type; it never logs the supplied token, configured digest, key ID, or
configuration value.

The endpoint gate must remain off until a later reviewed release replaces or
fronts this candidate with workforce OIDC, MFA, and deny-by-default RBAC. At
minimum, the future authorization model must distinguish queue triage, claim,
decision, audit review, and credential/role administration. Irreversible
content or account actions cannot rely on possession of one shared bearer
secret.

An activation-capable release must also fail closed on its complete operating
contract. Once both the source latch and `POST_MODERATION_ENABLED=true` select
the moderation path, authenticated routes and `/ready` require a valid dedicated
key-digest map, an integer response SLA from 1–168 hours, approved non-placeholder
moderation and retention policy versions, a named non-placeholder owner, and an
approved escalation email or credential-free HTTPS URL. An incomplete contract
returns sanitized `503`; it cannot fall back to candidate defaults or become
ready merely because the database responds. After configuration validation,
`/ready` runs one bounded catalog aggregate that requires the exact finished,
non-rolled-back migration receipt; named column presence plus reporter
nullability and revision defaults; exact moderation enum values; nine named
constraints plus the reporter/audit foreign-key actions; and ten named
valid/ready index entries including exactly two uniques. Any false result, query
failure, or timeout returns only sanitized `503 not_ready`. This is a bounded
presence/readiness attestation, not a comparison of every column type or every
constraint/index definition. Source and disposable-PostgreSQL tests prove
success and a transactionally removed-index failure; they do not authorize
activation or replace exact target-definition readback.

### API surface

The first reviewed surface is limited to:

| Route | Purpose | Required behavior |
| --- | --- | --- |
| `GET /moderation/reports` | List a bounded, cursor-paginated queue | `Cache-Control: no-store`; allow-listed filters; no reporter identity, user authentication data, wallet, credential, digest, or aggregate reporter export |
| `POST /moderation/reports/:reportId/claim` | Atomically claim one `OPEN` report | Require `expectedVersion`; carry an unlinked stale report forward to the current content revision, or close it as superseded only when that non-null reporter already has a linked current-revision report; return no linked/replacement locator; unavailable content closes all same-post pending siblings; return the exact target audit receipt |
| `POST /moderation/reports/:reportId/decision` | Atomically dismiss or remove | Require `expectedVersion`, `expectedPostRevision`, and a bounded decision code; only the assigned authorized reviewer may decide; target-only `DISMISS` returns `affectedReportCount=1`; removal is post-wide; an author edit rebases the review or closes the old report as linked superseded without exposing its locator instead of applying the requested decision; return the exact target audit receipt |

The unclaimed list returns neither post content nor the public feed `postId`.
Otherwise a reviewer could use that stable locator to bypass claim ownership
and open the unauthenticated public post route. Only the reviewer currently
assigned to a `REVIEWING` report may receive the `postId` and current post
fields necessary to review it. Post content is untrusted UGC: it must remain
inside the protected response, be escaped and size-bounded by the operator
client, and never be copied to logs, alerts, tickets, chat, screenshots,
analytics, or audit rows.
The response must not include `reporterId`, Privy DID, email, wallet, bearer
token, key digest, a replacement-report locator, or a stable reporter
pseudonym. `PostReport.reporterId` is a nullable ingest relation only: account
deletion sets it to `NULL` with `ON DELETE SET NULL`, preserving the report and
audit without creating a long-lived replacement pseudonym. A null reporter
cannot be used to infer same-reporter linkage. Media retrieval and safe
rendering require a separate reviewed design before media moderation is
considered operational.

### State and audit transaction

`Post.contentRevision` is a non-negative integer content identity, beginning at
zero and incremented for every author body/media edit and every redaction.
Report creation reads it under the shared post advisory lock and captures it in
`PostReport.postRevision`. The uniqueness boundary is
`(postId, reporterId, postRevision)`: a same-reporter replay against one
unchanged revision is idempotent, while a later author revision is a distinct
reportable unit. Wall-clock timestamps are not content identity and are not
used for revision comparison.

Migration delivery uses expand/contract. The additive expand migration adds the
revision fields, nullable reporter relation, audit table, and revision-scoped
unique index while retaining the legacy `(postId, reporterId)` unique index.
That stricter legacy index remains a compatibility brake: multiple revisions
per reporter/post cannot be admitted until an independently reviewed and
explicitly approved contract migration drops it. Gate-off source, an applied
expand migration, or a passing smoke does not authorize that destructive index
drop. Rollback must remain compatible with the retained legacy constraint until
the contract step is accepted.

The expand migration has a fail-fast legacy-state precondition before it creates
new types or changes schema: every existing `PostReport` must be exactly
`OPEN` with `reviewedAt IS NULL`. Before deployment, an operator must run and
record the reviewed aggregate SQL/readback from the runbook against the exact
target database. Any non-zero non-`OPEN` or reviewed count stops deployment.
Migration code must never invent reviewer evidence, and no unapproved backfill,
status rewrite, timestamp clearing, or manual row repair may be used to make the
precondition pass.

The same pre-DDL block also rejects any post with more than 250 pending
`OPEN`/`REVIEWING` reports; the exact target aggregate must show
`overCapPosts=0`. No unapproved deletion or coalescing is migration remediation.

The source contract now uses one shared
`PENDING_REPORTS_PER_POST_MAX=250` ceiling per post across all revisions. Report
admission counts under the shared post advisory lock; at the ceiling it creates
no row and returns the same public duplicate result without exposing the count.
The migration rejects legacy overflow and adds `idx_post_report_pending`.
Post-wide fan-out probes at most 251 rows and returns sanitized `503
report_fanout_exceeded` before any mutation when the invariant is broken, so the
decision transaction rolls back. Unit and disposable-PostgreSQL tests cover
coalescing, migration failure, exact-250 fan-out, and over-cap rollback. This
closes the source cardinality/fan-out gap, while named abuse ownership,
monitoring/alerts, exact target readback, CI receipts, and staging load/
concurrency evidence remain activation gates. The per-reporter daily limit is a
separate defense.

Report insertion uses target-free PostgreSQL `ON CONFLICT DO NOTHING` so the
same release is compatible with both the retained legacy unique index and the
new revision-scoped index. During expand, a later revision for the same
reporter/post still conflicts with the legacy index and returns the normal
duplicate outcome. Multi-revision insertion begins only after the separately
approved contract migration; catching a uniqueness error inside the interactive
transaction is not an approved substitute.

Use explicit, deny-by-default transitions:

```text
OPEN(current or unlinked stale revision) --CLAIM/carry-forward--> REVIEWING
OPEN(old revision with linked current report) --CLOSE_SUPERSEDED--> ACTIONED
REVIEWING(author edit, no linked current report) --REBASE_REVISION--> REVIEWING
REVIEWING(author edit, linked current report) --CLOSE_SUPERSEDED--> ACTIONED
REVIEWING(target only) --DISMISS--> DISMISSED
OPEN or REVIEWING --same-post REMOVE_POST--> ACTIONED
OPEN or REVIEWING --same-post CLOSE_UNAVAILABLE--> ACTIONED
```

Every claim and decision supplies the last observed integer version. The
database update matches both report ID and expected version, increments the
version once, and appends an immutable moderation audit event in the same
transaction. A zero-row update is a conflict, not permission to overwrite a
newer reviewer action.

The server generates a new UUID `operationId` for each claim or decision
operation. It is persisted and returned only when the audit transaction commits,
and is never accepted from a client. A client
`X-Request-ID` remains transport/log correlation only and is not persisted in
the moderation audit. Every report transitioned by one same-post fan-out shares
the operation ID.

The audit event contains only the opaque acting reviewer identity, report ID,
action code, policy version, previous and next status, previous and next
optimistic version, previous and next integer post revision, server-generated
operation ID, and server timestamp. Audit rows contain no client request ID,
reporter identity, post body, media URL, profile field, wallet, raw credential,
digest, free-text note, or raw exception. Audit retention and deletion semantics
require Privacy/Legal approval before any migration is accepted.

Credential minimization applies to both observability paths. HTTP logging must
redact the authorization header, replace any request ID containing an
`eg_mod_...` credential shape with a server UUID, drop query/fragment data, and
replace any misplaced moderation credential in a logged path. If optional
Sentry is enabled, its request and breadcrumb URLs use the same sanitizer;
headers, cookies, bodies, query data, user context, and local variables remain
excluded; and `beforeSend` plus `beforeBreadcrumb` recursively redact that
credential shape from enumerable error-event/breadcrumb strings. Regression
tests cover embedded request-ID, event, exception, stack-path, and breadcrumb
cases. `beforeSendTransaction` applies the same recursive sanitizer to
performance transaction/span strings, with regression coverage. A safe stdout
log or source test does not prove the exact-release Sentry path; both paths still
require independent value-safe staging evidence.

The immutable audit identity is the composite `(reportId, toVersion)` primary
key. This lets one operation create a separate receipt for each same-post
report, prevents two events from claiming the same resulting report version,
and lets the raw SQL fan-out insert audit rows without manufacturing an
unrelated audit-row ID. `operationId` remains an indexed correlation field, not
the audit primary key.

Every successful claim or decision response includes the exact target report's
audit receipt:

```text
operationId, reportId, policyVersion, action,
fromStatus, toStatus, fromVersion, toVersion,
fromPostRevision, toPostRevision, serverTimestamp
```

`fromPostRevision` and `toPostRevision` bind the event to explicit integer
content identities. They are equal for a transition within one unchanged
revision and differ for claim carry-forward, `REBASE_REVISION`,
`CLOSE_SUPERSEDED`, or a post-wide terminal action that moves older pending
reports to the final redacted/unavailable revision. A direct single-report
transition returns its inserted audit row. The raw SQL same-post fan-out reads
the exact target row by
`(reportId, toVersion)` inside the transaction and fails rather than returning
success if the receipt is absent or does not match the generated operation ID
and action. Fan-out also returns its transitioned report count, but does not
expose sibling receipts or reporter identity.

Report creation, author edit, ordinary owner deletion, and moderation
claim/decision all use the same post-scoped PostgreSQL advisory-lock namespace
before reading or mutating that post. This serializes content-revision changes,
new reports, owner redaction, moderator redaction, and same-post fan-out
so none can commit across a stale revision or availability check.

When an operator claims an `OPEN` report whose `postRevision` is older than the
current `Post.contentRevision`, the transaction looks for that same non-null
reporter's linked report at the current revision. If the relation is null or no
linked report exists, it carries the same
report row forward by changing its `postRevision` to the current integer while
claiming it and records `CLAIM` with different from/to post revisions. If the
linked current-revision report exists, only then is the old report terminally
closed as `CONTENT_SUPERSEDED` with `CLOSE_SUPERSEDED`; the response sets
`reviewRequired=true` but must not expose the linked report ID or any other
replacement locator. A linked current-revision report can be found only through
the independently authorized queue workflow. Linkage is status-agnostic: the
current-revision row may already be terminal. `reviewRequired=true` means the
stale report was not substantively decided and the reviewer must re-read queue
state; it neither promises an actionable replacement nor reopens a terminal row.

If an author edit is detected when the assigned reviewer submits a decision,
the requested `DISMISS` or `REMOVE_POST` must not execute against the changed
content. Without a linked current-revision report, the assigned report stays
`REVIEWING`, moves to the current post revision, increments its optimistic
version, appends `REBASE_REVISION`, and returns `reviewRequired=true`. The
reviewer must inspect the new revision and submit a later decision with the new
expected version and `expectedPostRevision`. If a linked current-revision report
for the same non-null reporter already exists, the old report instead follows
`CLOSE_SUPERSEDED` as above.
`CONTENT_SUPERSEDED` is prohibited when no such linked report exists.

`DISMISS` changes no post content and only transitions the assigned target
report owned by the acting reviewer. It returns `affectedReportCount=1`.
Every other `OPEN` or `REVIEWING` report—including the same reason/revision and
anything claimed by another reviewer—must remain unchanged. Post-wide fan-out
is reserved for the global content outcomes `REMOVE_POST` and
`CLOSE_UNAVAILABLE`. `REMOVE_POST` is not a UI label or local Hide. In one
PostgreSQL transaction it must:

1. lock and validate the assigned `REVIEWING` report and expected version;
2. redact the current post body and media, clear its author association, and set
   `deletedAt` using the same server timestamp;
3. transition every `OPEN` or `REVIEWING` report for that post, across captured
   revisions and reasons, to `ACTIONED`, increment each version, and set its
   review metadata; and
4. append one immutable `REMOVE_POST` audit event for every transitioned report,
   identifying the acting reviewer even when a sibling report had another
   assignee.

If actual moderator redaction changes anything other than exactly one available
post row, a sibling version changes, or any audit insert fails, the service
returns a conflict and rolls back all effects. It must never return success for
a status-only `REMOVE_POST` or a partially redacted post.

If an ordinary owner deletion committed first, or content is otherwise already
deleted/unavailable when an operator claims the report or its assigned reviewer
submits a decision, moderation does not pretend to remove it again. In the same
post-locked transaction it changes every same-post `OPEN` or `REVIEWING`
sibling, across captured revisions and reasons, to `ACTIONED` with resolution
`CONTENT_UNAVAILABLE`, increments every version, and appends one
`CLOSE_UNAVAILABLE` audit per report. Each audit records its own captured
`fromPostRevision` and the final unavailable `toPostRevision`. The success
response has `contentChanged=false`, the transitioned count, and the exact
target audit receipt. This is terminal queue cleanup, not a finding against the
author.

Evidence needed for appeal and any account-level sanction remain unresolved
activation blockers rather than implicit behavior.

### SLA, ownership, escalation, and retention

EasyGo proposes a 24-hour first-response SLA measured from report creation, not
from claim time. This is a product proposal, not an approved promise. A named
primary owner, backup owner, review schedule, breach alert destination, urgent
escalation path, user-contact owner, appeal path, and jurisdiction-aware policy
must be approved before the gate can open. A report reason may affect triage
priority but must never automatically sanction a user.

No retention duration is selected by this ADR. Before activation, EasyGo must
approve separate durations and deletion/legal-hold behavior for open reports,
terminal reports, minimal audit metadata, deleted-post topology, any restricted
evidence, operational logs, and backups. Raw UGC must not be duplicated merely
to make the queue convenient. If appeal or legal obligations require evidence,
that evidence needs a separately encrypted, least-privilege store and a
reviewed expiry policy.

Deleting a `User` only sets `PostReport.reporterId` to `NULL`, so the report and
its audit remain. That does not solve destructive retention: a hard `Post`
delete cascades to its reports, and a hard `PostReport` delete cascades to its
audit. Activation therefore requires an approved retention/purge contract,
legal-hold behavior, and database privileges that prevent the ordinary service
or an operator from issuing unapproved hard deletes. This candidate does not
provide those controls.

The independent account-deletion path also remains latched off. Its local purge
currently acquires locks for all posts owned by one user and redacts them in one
transaction; it does not provide bounded, checkpointed high-cardinality
post batching. Final user deletion can separately fan out `reporterId=NULL`
across every report by a high-volume reporter. The moderation lock integration
does not solve either scaling and recovery risk. A reviewed batching/resume
design and stress proof for both paths remain an account-deletion latch
activation blocker, separate from moderation readiness.

## Options Considered

### Option A: Reuse `ADMIN_SECRET` or advertiser authentication

| Dimension | Assessment |
| --- | --- |
| Complexity | Low |
| Privilege isolation | Unacceptable |
| Reviewer attribution | None or misleading |
| Revocation | Broad, deployment-coupled blast radius |
| Activation readiness | Stop-ship |

**Pros:** Minimal new authentication code.

**Cons:** Merges unrelated write privileges, encourages shared credentials,
cannot express reviewer roles, and makes one leak compromise multiple domains.

### Option B: Dedicated hashed stable reviewer keys

| Dimension | Assessment |
| --- | --- |
| Complexity | Low to medium |
| Privilege isolation | Better; separate prefix and digest map |
| Reviewer attribution | Opaque key ID only |
| Revocation | Per-key configuration change |
| Activation readiness | Staging foundation only |

**Pros:** Fail-closed, no raw key in configuration, constant-time digest
comparison, separate moderation namespace, and deterministic test coverage.

**Cons:** Long-lived bearer credentials have no MFA, workforce lifecycle,
recent authentication, or enforceable role claims. Stable key IDs do not prove
which human used a shared or copied key.

### Option C: Workforce OIDC with MFA and RBAC

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium to high |
| Privilege isolation | Strong |
| Reviewer attribution | Named immutable workforce subject |
| Revocation | Identity-provider and role lifecycle |
| Activation readiness | Required after security and privacy review |

**Pros:** Short-lived credentials, MFA, named attribution, least-privilege
roles, rapid offboarding, and auditable policy enforcement.

**Cons:** Requires an approved workforce identity provider, gateway/backend
validation, operational ownership, access reviews, and recovery procedures.

### Content-revision identity alternatives

Using `Post.updatedAt` as report identity is rejected because a wall-clock value
mixes unrelated mutations, depends on timestamp precision, and does not provide
an explicit monotonic fence for a moderation decision. Retaining one mutable
report per `(postId, reporterId)` is also rejected because it cannot distinguish
which content the allegation and review addressed. The selected monotonic
integer plus revision-scoped unique tuple preserves that distinction, but its
aggregate Sybil cardinality cost requires the separate post-wide pending
ceiling. The selected 250-row ceiling favors bounded transactions and
privacy-preserving coalescing over admitting every duplicate allegation;
operational ownership and monitoring remain required.

## Trade-off Analysis

Option A is rejected. Option B is useful as a bounded implementation foundation
because it establishes a separate credential namespace and safe failure
contract without pretending to solve workforce authorization. It must remain
default-off and must not be treated as production readiness. Option C is the
activation target because moderation decisions affect user speech and can
irreversibly redact content. The extra operational cost is justified by human
attribution, least privilege, MFA, and reliable revocation.

The API and transaction design can be implemented and tested while the gate is
off. That separates code review from operational authorization. It does not
permit migration or deployment under this ADR. Before the first real
`REMOVE_POST`, an enforcement-aware exact release must pass staging smoke and
be promoted as the new minimum safe rollback baseline; otherwise an older feed
release could ignore moderation state or restore inconsistent behavior.

## Consequences

- Moderation remains unavailable by default; existing report ingest continues
  independently.
- An activation attempt with an incomplete owner/key/SLA/policy/retention/
  escalation contract is unavailable and not ready, rather than partially live.
- Reporter identity is not part of operator responses or audit events; account
  deletion nulls the relation and creates no durable replacement pseudonym.
- Reports and decisions are tied to integer content revisions; author edits
  cause audited carry-forward, re-review, or linked supersession rather than a
  decision against stale content.
- Every transitioned report has one version-fenced state change and one exact,
  privacy-minimized audit event; fan-out events share a server-generated
  operation ID.
- `REMOVE_POST` is durable redaction, not local Hide, and cannot partially
  succeed.
- Already unavailable content is terminally resolved as `CONTENT_UNAVAILABLE`
  with `CLOSE_UNAVAILABLE`, not misreported as a new moderator removal.
- The current hashed-key candidate can support tests but cannot close the
  OIDC/MFA/RBAC stop-ship gate.
- EasyGo cannot promise the proposed 24-hour SLA until owner, coverage, alert,
  escalation, contact, and appeal procedures are approved.
- Retention, media review, evidence preservation, account sanctions, user
  contact, and appeals require subsequent decisions.
- Aggregate unresolved report cardinality is source-bounded at 250 pending rows
  per post across all revisions, with shared-lock coalescing, migration fail-fast,
  a pending index, and decision rollback above the cap. Activation still needs
  exact target/CI/staging receipts, monitoring, and an operational abuse owner.
- The expand migration must retain the legacy reporter/post unique index for
  rollback compatibility. Dropping it is a separate contract migration and
  approval; no down-migration is part of incident response.
- Legacy queue-state mismatch aborts expand before schema change; it is not
  permission to backfill. CI PostgreSQL proof complements but does not replace
  the exact target-database precondition readback.
- Prisma schema and migration SQL both declare `postRevision=0` and the same two
  named legacy/revision uniques. CI must continue validating the schema and
  asserting those exact physical catalog indexes after the full migration
  chain. The activation readiness catalog query additionally checks the exact
  migration receipt, named column presence with selected defaults/nullability,
  exact enums, named constraints with the two relevant foreign-key actions, and
  all ten named valid/ready index entries in one bounded read. Exact target
  definition readback remains separate.

## Action Items

1. [ ] Product, Security, Privacy/Legal, Backend, and the named moderation owner
   accept this ADR.
2. [ ] Approve and implement workforce OIDC, MFA, and deny-by-default RBAC.
3. [ ] Accept an additive expand migration that makes `reporterId` nullable with
   `ON DELETE SET NULL`, adds content-revision/version/audit/reviewer schema,
   and retains the legacy reporter/post unique index. Before applying it, record
   exact aggregate SQL proving every legacy row is `OPEN` and unreviewed; stop
   on any mismatch and never perform an unapproved backfill.
4. [ ] Independently review and accept the three protected endpoints behind
   `POST_MODERATION_ENABLED=false`; prove routes and `/ready` return sanitized
   `503` whenever key, SLA, approved policy/retention, owner, or escalation
   configuration is incomplete, and whenever the bounded database-catalog
   attestation is false, errors, or times out. Require bounded operator API rate
   limits to return `429` with `Retry-After`. Retain exact target-definition
   readback separately.
5. [ ] In CI, apply all migrations to disposable PostgreSQL and run the database
   integration suite without a moderation skip. Validate the aligned
   `postRevision=0` and named unique schema contract, assert the exact two
   physical indexes, and explicitly prove both the `OPEN` plus non-null
   `reviewedAt` failure branch and a nonempty all-`OPEN`/null success case.
6. [ ] Prove concurrent report creation/author edit/owner deletion/claim/decision
   locking, claim carry-forward, linked supersession without exposing a linked
   report ID, decision rebase and mandatory re-review, target-only dismissal
   that leaves every sibling and other reviewer claim unchanged, transaction
   rollback, actual post redaction, post-wide unavailable/removal fan-out,
   exact target receipts, composite audit identity, nullable reporter deletion,
   no-store responses, and credential/PII/UGC redaction in both HTTP logs and
   Sentry events/breadcrumbs. Verify the reviewer client escapes and bounds UGC,
   persists no moderation response, and never auto-fetches media.
7. [ ] Assign primary and backup owners; approve the SLA, monitoring,
   escalation, user-contact, and appeal procedures.
8. [ ] Approve retention, deletion, legal-hold, backup, restricted-evidence,
   hard `Post`/`PostReport` deletion, and least-privilege database rules that
   preserve required reports/audits.
9. [ ] Preserve the source-enforced 250 pending-row ceiling per post across all
   revisions, shared-lock admission/coalescing, migration fail-fast and pending
   index, and decision rollback at 251. Before activation, record exact target
   `overCapPosts=0`, CI and staging load/concurrency receipts, monitoring/alerts,
   and a named Sybil/abuse-response owner.
10. [ ] Keep every account-deletion latch closed until both owned-post redaction
   and reporter-null foreign-key fan-out have bounded, checkpointed
   high-cardinality batching/recovery designs and stress proof; this moderation
   candidate does not provide them.
11. [ ] After expand compatibility is proven, separately review and approve any
   contract migration that drops the legacy `(postId, reporterId)` unique index;
   do not combine or infer that approval from expand deployment.
12. [ ] Under separate approval, deploy the activation-capable release gate-off,
   bind the exact release to Railway evidence, and complete every pre-promotion
   prerequisite in the moderation runbook, including exact staging smoke and
   monitoring for that release. Only then may a separate operator decision
   promote an enforcement-aware rollback baseline. Runtime activation remains a
   later separate approval before the first real decision.
13. [ ] Reconcile the final operation with App Review Guideline 1.2, privacy
   disclosures, and the device/release checklists before exposing UGC in an App
   Store submission.

## Related documents

- [Moderation runbook](../MODERATION_RUNBOOK.md)
- [Backend deployment checklist](../DEPLOY_CHECKLIST.md)
- [Backend operations runbook](../OPERATIONS.md)
- [Legal and consent release blockers](../../../docs/LEGAL_CONSENT_RELEASE.md)
- [ADR-0005: Advertiser administration](./0005-scoped-advertiser-admin-aggregates.md)
