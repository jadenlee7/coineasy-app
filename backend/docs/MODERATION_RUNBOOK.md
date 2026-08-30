# EasyGo protected post-report moderation runbook

Status: **staging expand deployed gate-off; not approved for activation**.

This runbook defines the proposed operating boundary for the protected
`/moderation/reports` queue. A separate 2026-08-27 approval authorized only the
additive staging migration and exact gate-off web deployment recorded in the
[`DEPLOY_CHECKLIST`](./DEPLOY_CHECKLIST.md#exact-48bc35f-gate-off-moderation-expand-staging-rollout-2026-08-27-utc).
This runbook does not authorize source-latch or Railway gate activation,
reviewer-key provisioning, moderation decisions, user contact, App Store
submission, or retention/deletion actions.

The exact `48bc35f` staging release proves the reviewed expand migration,
bounded database contract, gate-off route isolation, and stabilization window.
It does not contain a verified operator moderation operation. Keep
`POST_MODERATION_READY=false` in source and `POST_MODERATION_ENABLED=false` in
Railway. A configured moderation-key digest does not activate the routes and is
not evidence of readiness.

## Unresolved activation owners

| Responsibility | Current owner | Activation requirement |
| --- | --- | --- |
| Primary moderation queue | **Unassigned** | Named person or staffed function with coverage schedule |
| Backup/on-call reviewer | **Unassigned** | Named backup and handoff procedure |
| Security/auth escalation | **Unassigned** | Workforce identity, credential-loss, and access-review owner |
| Privacy/Legal escalation | **Unassigned** | Jurisdiction, evidence, retention, and urgent-content owner |
| User contact | **Undefined** | Approved templates, sender, delivery channel, and privacy review |
| Appeal handling | **Undefined** | Intake, independent reviewer, deadline, and restoration limits |
| Response SLA | **24 hours proposed** | Product/operations approval, staffing proof, alert destination, and breach procedure |
| Per-post pending abuse bound | **250 source-enforced; activation unapproved** | Shared-lock admission/coalescing, migration and decision fail-fast, monitoring, Sybil response, and owner |

Every unresolved row is a stop condition. The 24-hour proposal is measured from
`PostReport.createdAt`; it is not a published or approved service commitment.

## Trust boundary

The moderation surface is separate from user, advertiser, and Orange
administration:

- do not accept a Privy user access token as moderator authorization;
- do not accept an `eg_adv_...` advertiser key;
- do not accept `ADMIN_SECRET` or `x-admin-secret`;
- do not use one reviewer key for multiple people; and
- do not put a raw moderation key, digest map, or key ID into Git, a PR, chat,
  a ticket, a screenshot, shell history, logs, or a tool transcript.

The current MVP candidate accepts only a dedicated `Authorization: Bearer
eg_mod_...` key whose SHA-256 digest is mapped to an opaque stable reviewer key
ID by `MODERATION_API_KEY_HASHES_JSON`. Missing/malformed/unknown keys fail with
`401`; missing or invalid server configuration fails closed with `503`. Logs
record only a bounded error type.

This candidate is not activation authorization. Workforce OIDC with MFA,
short-lived tokens, immutable workforce subject binding, deny-by-default RBAC,
offboarding, periodic access review, and break-glass recovery must be approved
and verified first. Never bypass that gate because a hashed key test passes.

In a future activation-capable release, the moderation routes and `/ready` share
one fail-closed operating-contract validator. With the source latch and runtime
gate selected, the validator requires a valid dedicated key-digest map,
`MODERATION_RESPONSE_SLA_HOURS` from 1–168, approved non-placeholder
`MODERATION_POLICY_VERSION` and `MODERATION_RETENTION_POLICY_VERSION`, a named
non-placeholder `MODERATION_OWNER`, and a valid
`MODERATION_ESCALATION_CONTACT` email or credential-free HTTPS URL. After
authentication, an incomplete route contract returns
`503 moderation_service_unconfigured`; `/ready` returns sanitized `503
not_ready` before its database query. With complete configuration, `/ready`
runs one bounded catalog aggregate requiring the exact completed/non-rolled-back
migration receipt, named column presence with selected reporter nullability and
revision defaults, exact enums, nine named constraints plus the two relevant
foreign-key actions, and ten named valid/ready index entries including exactly
two uniques. False, error, or timeout remains sanitized `503 not_ready`. This is
a bounded presence/readiness attestation, not a comparison of every physical
definition. Source and disposable-PostgreSQL tests prove success and a
transactionally removed-index failure; this is not target-release or activation
evidence. Do not add defaults or enable the gate to diagnose a missing value.

## Privacy boundary

Use opaque `PostReport.id`, action code, state, version, and timestamps for
unclaimed queue operations. Do not return the public `Post.id`
until the current reviewer has successfully claimed the report; exposing it
earlier would allow the public post endpoint to bypass claim ownership and
audit. Reporter identity is needed only as a nullable ingest relation; account
deletion uses `ON DELETE SET NULL` so the moderation record remains without a
long-lived replacement pseudonym. A null reporter is not linkable across
revisions. Reporter identity is not needed by a reviewer and must not appear in
the moderation API, audit rows, logs, metrics, alerts, tickets, screenshots,
user contact, or appeal material.

Never copy any of the following out of the protected request/response path:

- post body, media URL, profile text, username, or image;
- reporter or author Privy DID, email, provider subject, wallet, or token;
- moderator bearer key, SHA-256 digest, configuration JSON, or stable key ID;
- raw database/provider error, SQL parameters, or free-text reviewer note; or
- exact reporter totals grouped by a person or other identifying attribute.

The unclaimed queue shows no post content. Only the assigned reviewer may
receive the current post fields necessary for review after a successful claim.
Render text as untrusted, escaped, size-bounded UGC. Do not auto-open links or
fetch media in an unreviewed operator client. Media review remains unavailable
until its isolation and retention design is approved.

All moderation responses use `Cache-Control: no-store`. Operational logs use
method, path without query, status, duration, request ID, and bounded error
codes only. Audit events use the minimal fields defined in ADR-0011 and never
contain the client `X-Request-ID`, raw UGC, or reporter identity. The server
generates a UUID `operationId` for each claim/decision operation. It is
persisted and returned only when the audit transaction commits; all same-post
audit rows in that transaction share it.

Credential redaction must pass independently in both observability paths. HTTP
logging redacts `Authorization`, replaces any `X-Request-ID` containing a
moderation-credential shape with a server UUID, removes query/fragment data, and
replaces any misplaced `eg_mod_...` value in a logged path. Optional Sentry uses
the same URL sanitizer for request and breadcrumb URLs, discards headers,
cookies, bodies, query data, user context, and local variables, and recursively
redacts the credential shape from enumerable error-event/breadcrumb strings in
`beforeSend` and `beforeBreadcrumb`. Source regression tests cover embedded
request-ID, event, exception, stack-path, and breadcrumb cases.
`beforeSendTransaction` applies the same recursive sanitizer to performance
transaction/span strings, with regression coverage. Do not claim the
exact-release gate closed from source or stdout-log evidence alone.

## Content revision boundary

`Post.contentRevision` is a non-negative integer that starts at zero and
increments on every author body/media edit and every redaction. Report creation
captures the locked current value in `PostReport.postRevision`. A reporter may
create only one row for `(postId, reporterId, postRevision)`; replay within the
same immutable revision is idempotent, while a later revision is independently
reportable. Do not substitute `updatedAt` or another timestamp for either
integer.

The migration is expand/contract. The separately approved additive expand step
adds nullable `reporterId` with `ON DELETE SET NULL`, revision fields and index,
and audit/reviewer state while retaining the legacy `(postId, reporterId)`
unique index. That legacy index remains a compatibility brake, so the runtime
must not claim multi-revision admission until a later, independently reviewed
contract migration is explicitly approved to drop it. Never combine that index
drop with expand deployment or infer approval from a gate-off smoke.

The expand migration executes this semantic precondition before creating its
first enum: every legacy row must be `OPEN` and have `reviewedAt IS NULL`.
The committed SQL wraps that precondition and every following DDL statement in
one explicit `BEGIN`/`COMMIT` transaction. A statement failure therefore rolls
back the entire expand migration. It first takes a bounded
`ACCESS EXCLUSIVE` lock on `Post` and then `PostReport` in the same order used
by report/edit/delete flows. This drains in-flight post work and prevents a new
report write from racing the legacy-state and fan-out checks without a lock
upgrade deadlock. The ten-second limit bounds lock acquisition only; the locks
remain held until commit or rollback. Every migration statement has a separate
30-second timeout, but operators must still use an approved maintenance/traffic
drain window and an outer controlled-job timeout. Post/report reads pause while
the transaction holds the locks. Failure to acquire both locks or complete a
statement within its bound rolls the transaction back. After any failed
attempt, retain the exact error, run Prisma status plus the catalog readback,
and stop; do not use `migrate resolve`, manual DDL, or a partial forward repair
without a separately reviewed recovery approval.

Before deployment, run the following exact read-only aggregate against the
approved target database and record the successful readback, target identity,
UTC timestamp, and counts without exporting any row or reporter identifier:

```sql
SELECT
  COUNT(*)::bigint AS "totalReports",
  COUNT(*) FILTER (WHERE "status" <> 'OPEN')::bigint AS "nonOpenReports",
  COUNT(*) FILTER (WHERE "reviewedAt" IS NOT NULL)::bigint AS "reviewedReports",
  COALESCE((
    SELECT COUNT(*)::bigint
    FROM (
      SELECT "postId"
      FROM "PostReport"
      WHERE "status" IN ('OPEN', 'REVIEWING')
      GROUP BY "postId"
      HAVING COUNT(*) > 250
    ) AS "overCapPost"
  ), 0)::bigint AS "overCapPosts"
FROM "PostReport";
```

Proceed only when `nonOpenReports=0`, `reviewedReports=0`, and
`overCapPosts=0`; `totalReports` may be any non-negative value. A failed query is
`unobserved`, not a zero. Any non-zero failure count stops deployment and
requires an approved remediation contract. Never backfill reviewer metadata,
rewrite status, clear `reviewedAt`, delete/coalesce reports, or otherwise alter
legacy rows merely to make the migration pass.

Report creation uses target-free `ON CONFLICT DO NOTHING ... RETURNING id`.
This single insert is compatible with both unique indexes and avoids leaving an
interactive PostgreSQL transaction aborted by a caught uniqueness error. While
the legacy pair index remains, a later revision for the same reporter/post
returns the ordinary duplicate outcome. Only the separately approved contract
index drop permits a new row for that later revision.

The candidate now has one shared hard ceiling,
`PENDING_REPORTS_PER_POST_MAX=250`, across `OPEN`/`REVIEWING` rows for a post
across all revisions. Report creation counts under the same post advisory lock
used by edit/delete/moderation; at the ceiling it writes no row and returns the
same `{ reported: true, duplicate: true }` shape, so a Sybil cannot increase
fan-out or learn the exact count. The expand migration aborts before DDL if any
legacy post exceeds 250 and adds `idx_post_report_pending`. Post-wide decision
reads at most 251 pending rows and throws sanitized `503
report_fanout_exceeded` before mutation if the invariant is violated, so the
transaction rolls back. Unit and disposable-PostgreSQL tests cover admission,
migration failure, exact 250-row fan-out, and over-cap rollback.

This closes the source cardinality/fan-out implementation gap, but it is not an
activation receipt. A named abuse owner, alert/metric plan, safe operational
response, exact target `overCapPosts=0` readback, CI receipt, staging smoke, and
monitoring remain required. The existing per-reporter daily limit remains a
separate defense.

## Proposed API contract

The gate-off implementation is limited to these routes:

| Method and path | Input | Success | Conflict/failure |
| --- | --- | --- | --- |
| `GET /moderation/reports` | Allow-listed status, bounded limit, opaque cursor | Bounded queue metadata; no reporter identity, and no public post locator/content until assigned `REVIEWING` state | `400` invalid query; `401` auth; `404` gate off; `503` auth unavailable |
| `POST /moderation/reports/:reportId/claim` | `{ "expectedVersion": <integer> }` | Current or unlinked stale revision: atomically `OPEN -> REVIEWING`, carrying the same row to current revision when needed; linked current-revision row: terminal `CONTENT_SUPERSEDED`; unavailable content: close all same-post pending siblings; always return exact target audit receipt | `404` unknown/gate off; `409` stale, already claimed, or invalid transition |
| `POST /moderation/reports/:reportId/decision` | Strict `{ "expectedVersion": <integer>, "expectedPostRevision": <integer>, "decision": "DISMISS" \| "REMOVE_POST" }` | Unchanged revision: target-only dismiss with `affectedReportCount=1`, or exact-redact with post-wide fan-out; author edit: `REBASE_REVISION` and `reviewRequired=true`, or linked `CONTENT_SUPERSEDED`; unavailable content: close all same-post pending siblings; always return exact target audit receipt | `400` invalid body; `403` wrong reviewer/role; `404` unknown/gate off; `409` stale report/post revision or terminal state |

Responses must not echo a bearer token, key ID, digest, reporter identity,
linked/replacement report ID, raw exception, or exact SQL/provider detail.
Every successful mutation returns an `audit` object for the exact target report
with:

```text
operationId, reportId, policyVersion, action,
fromStatus, toStatus, fromVersion, toVersion,
fromPostRevision, toPostRevision, serverTimestamp
```

`operationId` is a server-generated UUID, never the client `X-Request-ID`.
Same-post fan-out returns `affectedReportCount` but does not return sibling audit
receipts. Audit rows use composite primary key `(reportId, toVersion)`; the SQL
fan-out does not create or expose a separate raw audit ID. Equal integer
`fromPostRevision`/`toPostRevision` values identify an action within one
unchanged content revision; differing values record carry-forward, rebase,
linked supersession, or movement of an older pending report to the final
redacted/unavailable revision during a post-wide terminal fan-out.

## State interpretation

| State | Operational meaning | Allowed next operation |
| --- | --- | --- |
| `OPEN` | Persisted report is unclaimed at its captured `postRevision` | `CLAIM`; carry-forward to current revision if no linked row exists; `CLOSE_SUPERSEDED` only if a linked current-revision row exists; or post-wide terminal fan-out under removal/unavailability |
| `REVIEWING` | One reviewer owns the report version and its current review revision | Target-only `DISMISS` or post-wide `REMOVE_POST` only if content revision is unchanged; `REBASE_REVISION` after an unlinked author edit; `CLOSE_SUPERSEDED` after a linked author edit; or post-wide terminal fan-out under removal/unavailability |
| `DISMISSED` | Reviewer found no approved removal basis | Terminal; reopening is undefined and prohibited |
| `ACTIONED` + `CONTENT_REMOVED` | `REMOVE_POST` committed with actual redaction | Terminal; restoration is undefined because content is redacted |
| `ACTIONED` + `CONTENT_UNAVAILABLE` | Content was already deleted/unavailable and pending reports were closed with `CLOSE_UNAVAILABLE` | Terminal queue cleanup; not a moderator removal finding |
| `ACTIONED` + `CONTENT_SUPERSEDED` | This old report was internally linked to a report from the same non-null reporter at the current content revision and closed with `CLOSE_SUPERSEDED` | Terminal old-revision cleanup; `reviewRequired=true`, but no replacement report ID/locator is returned |

`REBASE_REVISION` is an audited `REVIEWING -> REVIEWING` transition, not a
decision: it increments report version, moves `postRevision`, and requires a
fresh content review. There is no manual status edit, force claim, reopen,
account sanction, or silent terminal transition in this MVP. `DISMISS` is
target-only. Bulk behavior is reserved for post-wide removal/unavailability
below. A need for another operation stops the procedure and requires a reviewed
design.

The internal supersession lookup is not limited by replacement status. A linked
current-revision row may already be terminal. In that response,
`reviewRequired=true` means the stale report received no substantive decision
and the reviewer must re-read the protected queue; it does not promise an open
replacement or authorize reopening.

## Review procedure after future activation approval

These steps describe the intended controlled workflow. Do not perform them
while the current status is plan-only.

### 1. Pre-access checks

1. Verify the exact deployed release, deployment ID, runtime gate, migration
   status, and `/ready` result without printing configuration values.
2. Verify the reviewer is using their own short-lived workforce session with
   MFA and the required role. A static MVP key alone is insufficient.
3. Confirm the named queue owner and backup are on duty and that the proposed
   SLA monitor is live.
4. Confirm the operator client does not persist responses, screenshots, browser
   history with query data, or UGC in telemetry.

### 2. List and triage

1. Read a bounded oldest-first queue page. Do not export or bulk-copy it.
2. Use the report reason only as a triage signal. Never assume the allegation
   is true and never auto-sanction from a reason count.
3. Do not search for or reveal the reporter. If an exceptional investigation
   genuinely requires that identity, stop and use a separately approved
   Privacy/Legal break-glass procedure; this repository does not authorize one.
4. If the post contains media, a credible urgent-safety issue, or content that
   cannot be reviewed safely, do not improvise. Preserve only the opaque report
   ID and follow the still-unapproved escalation path.

### 3. Claim

1. Submit the report ID and last observed `expectedVersion` once.
2. Treat `409` as evidence that state changed. Re-read the protected record;
   never overwrite, retry with a guessed version, or update the database
   manually.
3. For available content at the captured revision, confirm the response shows
   `REVIEWING`, one incremented report version, assigned ownership, and an exact
   target `CLAIM` receipt whose report and post revision transitions match.
4. If the report is stale because the author edited the post, inspect the
   response rather than assuming a claim. When the same non-null reporter has
   no linked current-revision report, the same row is carried forward to current
   `Post.contentRevision`, becomes `REVIEWING`, and returns a `CLAIM` receipt
   with different `fromPostRevision`/`toPostRevision`. When a linked
   current-revision report exists for that non-null reporter, the old row
   instead becomes `ACTIONED` + `CONTENT_SUPERSEDED` under
   `CLOSE_SUPERSEDED`; confirm
   `reviewRequired=true` and confirm that no linked report ID or replacement
   locator is returned.
5. If content is already unavailable, do not expect `REVIEWING`. Confirm
   `ACTIONED` + `CONTENT_UNAVAILABLE`, `contentChanged=false`, the same-post
   affected count, and an exact target `CLOSE_UNAVAILABLE` receipt.
6. Do not copy any receipt outside the protected system. The proposed
   deadline remains `createdAt + 24 hours`, not claim time.

### 4. Re-review after an author edit

Every decision body carries both the last observed report `expectedVersion` and
the content `expectedPostRevision`. If the post changed after claim, the
requested decision is not applied to the new content.

1. With no linked current-revision report for the same non-null reporter—or when
   `reporterId` is null and no linkage is possible—confirm the report remains
   `REVIEWING`, its `postRevision` and optimistic version each advance, the
   audit action is `REBASE_REVISION`, and
   `reviewRequired=true`.
2. Re-read and review the newly returned content. Never immediately replay the
   prior decision or guess the new version.
3. Submit a later decision only with the newly observed report version and post
   revision.
4. If a linked current-revision report exists, confirm the old report instead
   closes as `CONTENT_SUPERSEDED`/`CLOSE_SUPERSEDED`, returns
   `reviewRequired=true`, and exposes no linked report ID or replacement
   locator. Never record `CONTENT_SUPERSEDED` merely because content changed;
   an internal linked row for the same non-null reporter is required.

### 5. Close unavailable content

Author edit, ordinary owner deletion, report creation, claim, and decision share
the same post-scoped advisory lock. If owner deletion wins the lock and commits
first, a later claim or assigned decision terminally resolves the queue rather
than trying to redact the post again.

1. Do not infer a policy violation from missing content.
2. In one transaction the service changes every same-post `OPEN` or `REVIEWING`
   sibling across captured revisions and reasons to `ACTIONED`, sets
   `CONTENT_UNAVAILABLE`, increments every report version, and inserts one
   `CLOSE_UNAVAILABLE` audit per report. Each audit carries that report's
   captured `fromPostRevision` and the final unavailable `toPostRevision`.
3. Every audit in the fan-out shares the server-generated operation ID. The
   response returns only the exact target receipt plus `affectedReportCount`.
4. A missing/mismatched target receipt, sibling count/version conflict, or audit
   insert failure rolls back every transition.

### 6. Dismiss

1. Submit `DISMISS` once with the current report version and
   `expectedPostRevision`. Do not enter free text or copy UGC into the decision.
2. Confirm one transaction changed no post content and dismissed only the
   assigned target owned by the acting reviewer. Confirm
   `affectedReportCount=1`. Every sibling—including the same reason/revision,
   any other `OPEN` row, and every report claimed by another reviewer—must
   remain unchanged.
3. Confirm the exact target `DISMISS` receipt has the matching operation ID,
   policy, action, status/version transitions, equal
   `fromPostRevision`/`toPostRevision`, and server timestamp.
4. A user-contact or reporter-contact message is not authorized by dismissal.

If the content became unavailable after claim, the service performs the
`CLOSE_UNAVAILABLE` path above instead of recording `DISMISS`.

### 7. Remove post

1. Confirm the reviewer is authorized for irreversible removal under the
   future RBAC policy. The hashed-key candidate alone cannot prove this.
2. Submit `REMOVE_POST` once with the current report version and
   `expectedPostRevision`. Do not enter free text or copy UGC into the decision.
3. Success requires one post-level locked database transaction to validate the
   assigned report, redact exactly one current post's body/media and author
   association, set `deletedAt`, transition every same-post `OPEN` or
   `REVIEWING` report across captured revisions and reasons to `ACTIONED`,
   increment each version, and append one policy-versioned audit event per
   transition.
4. A sibling report already claimed by another reviewer is still closed because
   the underlying post was removed; its audit identifies the acting reviewer.
   Any sibling conflict or audit failure rolls back the redaction and all
   report transitions.
5. Verify through a read-only protected response that the target report is
   `ACTIONED`, the post is unavailable, and the returned
   `affectedReportCount` is consistent. Verify the exact target `REMOVE_POST`
   receipt fields and never
   query or copy the old body as proof.
6. If content became unavailable before the transaction reads it, expect the
   `CLOSE_UNAVAILABLE` path rather than `REMOVE_POST`. If content was available
   but redaction does not affect exactly one row, or any later effect is
   inconsistent, expect `409` and complete rollback. Escalate with opaque
   operation/report ID for an accepted mutation or HTTP request ID for a failed
   request. Do not patch content, status, version, or audit rows manually.

Restoration, author sanctions, evidence for appeal, and user notification are
unresolved. Do not infer behavior or perform those operations until a reviewed
contract exists.

## Conflict, outage, and credential response

- `401`: stop. Confirm the intended workforce session and authentication
  domain without displaying the token. Repeated failures are a Security event.
- `403`: stop. Do not switch credentials or request a higher role merely to
  bypass the decision.
- `404`: distinguish default-off gate from unknown report using value-safe
  release/config checks. Do not enable the gate as a diagnostic.
- `409`: another state/version won. Re-read; never force an update.
- `429`: respect `Retry-After`; do not fan out requests or change identities.
- `5xx`/`503`: stop decisions, keep ingest independent, verify `/ready`, exact
  release, and bounded sanitized error counts. Never dump environment or DB
  rows.
- suspected key loss: disable the moderation gate, revoke the individual
  credential through a separately approved secure session, review bounded
  audit metadata, and keep all report/action rows intact. Do not rotate
  `ADMIN_SECRET`, advertiser keys, or Privy credentials as a substitute.

If an operational query fails, its empty/zero output is not evidence of zero
events. Preserve only command success, bounded counts, server operation IDs for
accepted mutations, HTTP request IDs for failed transport/request correlation,
release, and timestamps. Keep provider/platform surfaces explicitly
`unobserved` until their authoritative audit succeeds.

## Proposed SLA and escalation

The current proposal is first response within 24 hours of report creation.
Until approved, it is planning input only.

Proposed monitoring uses only aggregate counts:

- warn on an unclaimed or unresolved report approaching the 24-hour deadline;
- page the named owner and backup on a deadline breach;
- alert Security on repeated moderation-auth failures or an unexpected gate-on
  state; and
- alert Backend on moderation 5xx, transaction conflicts above the reviewed
  baseline, any status/redaction/audit consistency failure, or an unresolved
  post/revision count approaching the still-to-be-approved hard bound.

The alert destinations, warning threshold, urgent-content categories, after-
hours coverage, Privacy/Legal contact, law-enforcement process, user contact,
and appeal owner are not yet approved. Alerts and tickets must contain only
opaque report/operation IDs for accepted mutations, HTTP request IDs for
failures, and aggregate state/age counts, never UGC, reporter identity, or
credentials. Any urgent case before approval is a stop condition, not
permission to invent an escalation channel.

## Retention and deletion

No moderation retention schedule is approved. Do not create a purge job,
snapshot raw UGC, extend log retention, or promise evidence preservation from
this runbook. The candidate's reporter relation is intentionally nullable with
`ON DELETE SET NULL`; do not replace it with cascade deletion or a durable
pseudonym without a new Privacy/Legal decision.

Before activation, Privacy/Legal and Security must approve:

- durations for `OPEN`, `REVIEWING`, `DISMISSED`, and `ACTIONED` records;
- minimal audit-event retention and reviewer-identity treatment;
- retention behavior after reporter deletion nulls `reporterId`, and when the
  post/author is deleted;
- whether any appeal/legal evidence is needed, where it is encrypted, who may
  access it, and when it is purged;
- legal holds and their audited release;
- backup, operational-log, and remote-observability retention; and
- restoration limits after destructive `REMOVE_POST` redaction.

Reporter identity remains excluded from operator output regardless of the
chosen database retention. Nulling the relation must not create, derive, or
retain a stable reporter pseudonym. Raw content must not be duplicated by
default.

`User` deletion and hard content deletion have different consequences. Deleting
a reporter `User` sets `PostReport.reporterId=NULL` and preserves both the
report and its audit. A hard `Post` delete still cascades through `PostReport`,
and a hard `PostReport` delete cascades through `PostReportAudit`. Until
retention, legal holds, an authorized purge process, and least-privilege database
roles prevent unapproved hard deletes, activation is blocked. Do not use direct
SQL or an ORM delete as moderation cleanup.

The independent account-deletion local purge is also not solved here. It
currently locks every post owned by one user and redacts them in one transaction
rather than using bounded, checkpointed post batches. For a high-cardinality
author this can expand transaction time, lock count, and retry cost. Final user
deletion can separately fan out `reporterId=NULL` across every report by a
high-volume reporter. Keep every account-deletion source latch and runtime flag
closed until both paths have a reviewed batch/resume design and stress proof;
the moderation candidate's shared lock does not close that blocker.

## Rollback boundary for a future release

No activation, real moderation action, or rollback-floor promotion is
authorized now. The separately approved 2026-08-27 rollout completed the
verified backup/restore, exact-target readback, additive expand migration, and
gate-off web deploy/smoke/monitor steps only. The current operator-facing
minimum safe reviewed web source floor and snapshot availability remain
recorded in
[`OPERATIONS.md`](./OPERATIONS.md#minimum-safe-web-rollback-baseline).

For a future approved rollout:

1. Require CI to start disposable PostgreSQL, apply the full migration chain,
   and run the moderation integration suite without a database skip. Preserve
   the physical-catalog assertion that exactly the two unique indexes named by
   schema and migration exist, with aligned `postRevision=0`, and explicitly
   test the `OPEN` plus non-null `reviewedAt` fail-fast branch and a nonempty
   all-`OPEN`/null success state.
2. After a verified encrypted backup, run the exact legacy-state SQL readback
   on the target and apply the reviewed expand migration only when all three
   failure counts are zero. Preserve the legacy `(postId, reporterId)` unique index and
   perform no backfill.
3. Deploy the exact enforcement-aware release with the moderation gate off.
4. Prove auth failure, complete-contract `503` behavior, exact catalog-contract
   success and fail-closed mismatch, queue isolation, optimistic conflicts,
   transaction
   rollback, redaction, audit minimization, health, and log privacy in staging.
5. Verify HTTP-log and Sentry-event credential sanitization independently,
   complete the required monitoring window, and promote that exact release as
   the new minimum safe rollback baseline before the first real decision.
6. After any moderation state/action is written, never roll below the
   enforcement-aware baseline. Disable the gate and forward-fix; do not
   down-migrate or manually erase audit rows.

Dropping the legacy reporter/post unique index is a separate contract migration
with a separate approval and rollback review. Expand deployment, smoke, or gate
activation approval does not authorize that drop.

No moderation success may be claimed without the exact target audit receipt.
For `CLAIM`, `REBASE_REVISION`, `CLOSE_SUPERSEDED`, `DISMISS`, `REMOVE_POST`, or
`CLOSE_UNAVAILABLE`, verify action, from/to report version, integer
`fromPostRevision`/`toPostRevision`, and server timestamp against the returned
report/operation. A dashboard screenshot, missing feed card, client request ID,
or HTTP status alone is not a receipt.

## Activation checklist

- [ ] ADR-0011 is accepted by Product, Backend, Security, Privacy/Legal, and a
      named moderation owner.
- [ ] One exact candidate version in the
      [policy approval packet](./MODERATION_WORKSPACE_WEBAUTHN_POLICY_APPROVAL_PACKET.md)
      is jointly ratified for a separately approved non-production proof. The
      proof receipts are then reviewed and the final exact Google,
      opaque-session, WebAuthn, access, rate, retention, SLA, recovery, and
      ownership values are jointly accepted. A proposal PR, merge, or candidate
      ratification alone is not operating approval, and every external-proof,
      unselected-stop, and human-name row is complete before implementation.
- [ ] Workforce OIDC, MFA, short-lived sessions, deny-by-default RBAC,
      offboarding, access review, and break-glass handling pass security review.
- [ ] Primary/backup owners, coverage schedule, approved SLA, alert targets,
      urgent escalation, user contact, and appeal handling are assigned and
      exercised.
- [ ] The dedicated key map, SLA, approved moderation/retention policy versions,
      named owner, and escalation contact are complete; authenticated routes and
      `/ready` return sanitized `503` when any one is absent or unapproved.
      `/ready` also returns sanitized `503` for a missing/rolled-back migration,
      missing named column/selected default/nullability, enum mismatch, missing
      named constraint/relevant FK action, invalid/missing named index,
      catalog-query error, or timeout. The bounded attestation and separate exact
      target-definition readback pass on the approved target.
- [ ] Retention, deletion, legal-hold, evidence, backup, and observability
      policies are approved and match public disclosures. Hard `Post` or
      `PostReport` deletion cannot bypass them, and database roles cannot perform
      an unapproved cascading purge of reports/audits.
- [x] The additive expand migration makes `reporterId` nullable with
      `ON DELETE SET NULL`, adds revision/audit state, retains the legacy
      reporter/post unique index, and is independently reviewed, tested, and
      separately approved for staging deployment. The exact target SQL readback
      proves all legacy reports are `OPEN` and unreviewed; no backfill was used.
      The exact 2026-08-27 receipt records zero legacy reports, the completed
      non-rolled-back migration, both retained unique indexes, and
      `contractReady=true`.
- [ ] Any contract migration that drops the legacy reporter/post unique index
      has a later independent approval after expand compatibility and rollback
      evidence; it is not bundled with or inferred from expand.
- [ ] Reporter identity, UGC, credentials, digests, key IDs, and raw exceptions
      are absent from responses where prohibited, logs, alerts, metrics,
      tickets, screenshots, and audit rows. Account deletion nulls the reporter
      relation without creating a long-lived pseudonym. HTTP logs and optional
      Sentry request/breadcrumb events independently redact misplaced
      moderation credentials.
- [x] CI applies the full migration chain to disposable PostgreSQL and runs the
      moderation integration suite with `TEST_DATABASE_URL` present and no
      database skip. It also asserts the physical catalog has exactly the two
      unique constraints named by schema and migration, verifies aligned
      `postRevision=0`, and explicitly exercises `OPEN` plus non-null
      `reviewedAt` rejection and a nonempty all-`OPEN`/null success.
      PR #65 run `33080997485` reported Backend `331` pass, `0` fail, and
      `0` skip. Its tested PR-head tree exactly equals the deployed merge tree;
      the merge SHA has no independent workflow run.
- [ ] PostgreSQL tests prove concurrent claim, stale decision, wrong reviewer,
      author-edit/ordinary-owner-delete/report-create shared locking,
      revision-scoped duplicate requests, claim carry-forward, linked-only
      `CONTENT_SUPERSEDED`, decision `REBASE_REVISION` with mandatory re-review,
      no replacement-report locator in responses, target-only dismissal with
      `affectedReportCount=1` while every sibling and other reviewer claim stays
      unchanged, transaction rollback, post-wide removal and unavailable-content
      disposition across pending revisions, nullable reporter deletion, and
      exact target audit receipts using
      composite `(reportId, toVersion)` identity.
- [ ] Report insertion proves target-free `ON CONFLICT DO NOTHING` compatibility
      with both retained legacy and revision indexes; before the contract drop,
      a later revision returns the duplicate outcome without aborting the
      transaction.
- [ ] The source-enforced maximum of 250 unresolved `OPEN`/`REVIEWING` rows per
      post across all revisions is retained by shared-lock admission/coalescing,
      migration fail-fast, `idx_post_report_pending`, and decision rollback at
      251. Record exact target `overCapPosts=0`, non-skipped CI, staging load/
      concurrency smoke, monitoring/alerts, and a named Sybil/abuse-response
      owner before activation. The per-reporter daily limit is a separate layer.
- [ ] Every account-deletion latch remains closed until owned-post redaction is
      bounded and checkpointed for high-cardinality authors, reporter-null FK
      fan-out is bounded, and both retry/resume behaviors pass stress testing.
      This moderation candidate is not that fix.
- [ ] Bounded list, rate limit, `Cache-Control: no-store`, safe UGC rendering,
      request correlation, and 401/403/404/409/429/5xx behavior pass staging.
- [ ] Future activation readiness requires both the protected-queue catalog
      contract and the PostgreSQL GCRA catalog contract with strict AND
      semantics. PR #69 merge
      `7acef194f032c05a6370346bea3a367101a01407` supplies the gate-off GCRA
      code and migration only; the migration is not recorded as applied, and
      thresholds, retention, cleanup, deployment, and activation remain
      separately approved work.
- [ ] An exact enforcement-aware release is deployed with the gate off, smoked,
      monitored, and promoted as the minimum safe rollback baseline.
      Exact `48bc35f` completed the deploy, gate-off smoke, and monitoring
      substeps. It is not yet activation-capable because the source latch
      remains false, and the rollback-floor promotion remains a separate
      operator decision.
- [ ] Disposable staging accounts pass reviewer and user device QA without
      exposing reporter identity or contacting a real user.
- [ ] App Review Guideline 1.2, privacy disclosures, retention copy, and the
      release/device checklists are reconciled.
- [ ] A separate explicit approval enables `POST_MODERATION_ENABLED=true`.

Any unchecked item keeps the moderation gate closed.

## Related documents

- [ADR-0011: Protected post-report moderation](./adr/0011-protected-post-report-moderation.md)
- [Workspace OIDC and WebAuthn policy approval packet](./MODERATION_WORKSPACE_WEBAUTHN_POLICY_APPROVAL_PACKET.md)
- [Backend deployment checklist](./DEPLOY_CHECKLIST.md)
- [Backend operations runbook](./OPERATIONS.md)
- [Secret rotation runbook](./SECRET_ROTATION_RUNBOOK.md)
- [Legal and consent release blockers](../../docs/LEGAL_CONSENT_RELEASE.md)
