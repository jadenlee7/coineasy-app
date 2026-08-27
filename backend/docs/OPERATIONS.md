# EasyGo backend operations runbook

Status: S9 implementation, all committed additive staging migrations through
`20260826144000_moderation_queue`, the exact `48bc35f` gate-off web rollout,
and authenticated PostReport ingest smoke are complete. The latest encrypted
staging backup passed an actual isolated PostgreSQL 18 restore drill. The
remaining gates include matched published privacy/terms, security exceptions,
the protected moderation operation and workforce trust domain,
release-bundle/device QA, and rollback drills.

## Railway staging target

The verified target is project `easygo-app-staging`
(`cad97a26-a680-4b8e-a366-f15b0412244f`), environment `staging`
(`f59e8f5a-406d-410f-a273-0020089860cd`). Its service IDs are:

- Postgres: `16994f70-8e17-47f7-bb50-55ac211af412`
- Web: `518ba3f5-486b-42a4-ad0c-27fb56e63b00`
- Worker: `0ffb8648-fe59-4fb7-926f-3cc9445c133d`

Postgres is running with a ready persistent volume and all committed migrations
through `20260826144000_moderation_queue` applied; Prisma reports no pending
migration. Web serves the public staging domain from exact release
`48bc35fca41fa8f693a95aee8c4b8dc339fee581`, with `/ready` healthy, the
authenticated Report ingest contract verified, and the protected moderation
surface gate-off at HTTP `404`. The exact tuple and receipts are in
[`DEPLOY_CHECKLIST.md`](./DEPLOY_CHECKLIST.md#exact-48bc35f-gate-off-moderation-expand-staging-rollout-2026-08-27-utc).
Web and worker revisions are deployed and rolled back independently. The
unchanged worker remains on its prior reviewed revision and exits successfully
while `SEGMENTS_ENABLED=false`. The project's default `production` environment
remains empty; do not add services or variables there during staging work.

### Protected moderation expand — deployed gate-off, not activated

[`ADR-0011`](./adr/0011-protected-post-report-moderation.md) and the
[`MODERATION_RUNBOOK`](./MODERATION_RUNBOOK.md) describe a default-off
moderation queue candidate. The separately approved 2026-08-27 expand rollout
applied `20260826144000_moderation_queue` and deployed exact `48bc35f` after a
verified backup and restore drill. `POST_MODERATION_READY=false` remains the
source brake, Railway `POST_MODERATION_ENABLED=false` is explicit, and deploy
preflight still rejects activation. Do not provision reviewer credentials,
change the source latch, enable the Railway flag, expose an operator client, or
exercise a real moderation decision without separate approvals for each state
change.

In a future activation-capable release, both an authenticated moderation route
and `/ready` must return a sanitized `503` unless dedicated reviewer-key hashes,
an approved response SLA, approved policy and retention-policy versions, a
named owner, and a credential-free escalation contact are all valid. Placeholder
or default values do not satisfy the contract. The current source latch remains
closed, so this readiness behavior is a future activation check rather than a
claim about the gate-off deployed `48bc35f` release.

After that configuration validation, one bounded `/ready` catalog aggregate
requires the exact completed/non-rolled-back migration receipt, required
named column presence with selected reporter nullability/revision defaults,
exact enums, nine named constraints plus two relevant foreign-key actions, and
ten named valid/ready index entries including exactly two uniques. Any mismatch,
query error, or timeout returns sanitized `503 not_ready`. This bounded
attestation does not compare every definition or exclude every extra audit
column. Source and disposable-PostgreSQL tests cover success and a
transactionally removed-index failure; exact target definition/privacy readback,
migration, and deployment approval remain separate.

Before any future activation, complete workforce OIDC/MFA/RBAC, operator API
rate limiting with `429` plus `Retry-After`, an escaped and size-bounded
non-persistent reviewer client with media auto-fetch disabled, named owner and
backup coverage, approved SLA/escalation/contact/appeal, retention and legal
hold policy, PostgreSQL concurrency/rollback tests, exact-target/CI/staging
proof and monitoring for the source-enforced 250 pending-row ceiling per post
across all revisions, a named Sybil/abuse owner, encrypted backup and additive
migration verification, value-safe staging smoke, monitoring, and promotion of
the exact enforcement-aware release as the new minimum safe web rollback
baseline. Until then, authenticated report ingest remains independent and the
protected moderation route must remain indistinguishable from absent.

The source candidate uses one post advisory-lock namespace across author edit,
ordinary owner deletion, report creation, and moderation. It increments integer
`Post.contentRevision` on edits/redaction, captures it in
`PostReport.postRevision`, and scopes replay uniqueness to
`(postId, reporterId, postRevision)`. Claim carries an old report to the current
revision only if no linked current-revision report exists; a decision after an
author edit returns `REBASE_REVISION` with `reviewRequired=true` rather than
applying the decision. Only a linked current-revision report permits
`CONTENT_SUPERSEDED`, and no linked/replacement report ID is returned.
`DISMISS` changes only the assigned target with `affectedReportCount=1`; every
sibling and other reviewer claim remains unchanged. Available-content removal
must redact exactly one post and resolve every pending sibling atomically;
already unavailable content resolves every pending sibling as
`CONTENT_UNAVAILABLE` with `CLOSE_UNAVAILABLE`.

Every accepted mutation generates a server UUID `operationId`; all fan-out
audits share it, while each audit is identified by composite
`(reportId, toVersion)`. The response must contain the exact target receipt—
action, from/to report version, integer `fromPostRevision`/`toPostRevision`, and
server timestamp. A client `X-Request-ID` remains HTTP/log correlation and is
never stored as the audit identity or receipt.

Schema delivery is expand/contract. The additive expand migration makes
`PostReport.reporterId` nullable with `ON DELETE SET NULL`, creates no durable
reporter pseudonym, adds revision/audit state, and retains the legacy
`(postId, reporterId)` unique index for compatibility. Do not claim
multi-revision admission or drop that index during expand. The index drop is a
later contract migration requiring independent approval and rollback evidence;
no deployment, smoke, or gate approval implies it.

Before expand, run and retain the exact target-database aggregate from the
moderation runbook. It must show `nonOpenReports=0` and `reviewedReports=0`;
query failure or missing readback is unobserved, not zero. The migration fails
fast when any legacy row is not `OPEN` or has non-null `reviewedAt`. Stop on that
failure: no backfill, status rewrite, or timestamp clearing is authorized.
Report creation deliberately uses a target-free `INSERT ... ON CONFLICT DO
NOTHING`, so it remains valid with both unique indexes; before contract, a later
revision from the same reporter is still a duplicate.

User deletion sets a report's `reporterId` to `NULL` and preserves the report
and its audit without creating a pseudonym. Hard `Post` or `PostReport` deletion
can still cascade-delete moderation evidence. Retention/legal-hold rules and
database privileges that prevent unauthorized hard deletes therefore remain
activation blockers. Account deletion also locks and redacts all owned posts in
one transaction and can fan out `reporterId=NULL` across all reports by the
deleted user; there is no bounded/checkpointed high-cardinality path. The
moderation candidate does not resolve that independent deletion-latch blocker.

CI release evidence must come from the disposable PostgreSQL service after
`prisma migrate deploy` and a non-skipped database integration suite. A local
skip because `TEST_DATABASE_URL` is absent does not qualify. The Prisma schema
and migration SQL both name the retained legacy and revision unique indexes and
declare `postRevision=0`; CI must continue asserting exactly those two physical
catalog indexes after the full migration chain. Explicit integration cases must
also cover the `OPEN` plus non-null `reviewedAt` fail-fast branch and a nonempty
all-`OPEN`/null-`reviewedAt` success case.

Required staging configuration is present and the value-safe deployed preflight
passes with zero failures. Optional Sentry, Better Stack, and Telegram values
remain intentionally unset pending vendor/privacy approval. Never record secret
values in this document or CLI output. Treat tool transcripts as operational
logs: do not call bulk environment/configuration/variable endpoints whose
response schema may include values. Use a fixed metadata allowlist or a
value-safe validator such as `preflight:staging`. If credential material is
printed, stop querying immediately and follow
[`SECRET_ROTATION_RUNBOOK.md`](./SECRET_ROTATION_RUNBOOK.md).

## Process topology

| Process | Command | Public traffic | Safe default |
| --- | --- | --- | --- |
| Web | `node src/index.js` | Express API, `/health`, `/ready` | Starts with all existing feature defaults |
| Segment worker | `node src/worker.js` | None | Starts then stays dormant when `SEGMENTS_ENABLED=false` |

`Procfile` records the same contracts. On Railway, create two services from the
same commit and `backend/` root. Set the web service config path to
`/backend/railway.web.json` and the worker path to
`/backend/railway.worker.json`. Only the web service receives a public domain;
its health-check path is `/ready`. Scale and roll back the two services
independently.

Do not use `railway scale <only-region>=0` as a maintenance drain for this
single-region web service. On 2026-08-27 it removed the configured region but
Railway selected a default region and created a deployment from the stale
connected Git source instead of leaving zero replicas. For an approved
maintenance window, first preserve an exact known-good rollback source, stop
the exact running deployment, and prove the public endpoint is unavailable
before applying a database migration. Restart only by uploading the reviewed
exact source archive; never use the stale connected branch or an implicit
`redeploy`.

Railway and the Procfile launch the Node entry points directly. Do not wrap
these production commands in `npm start` or `npm run`: Railway sends `SIGTERM`
to the top-level process during replacement, and the direct process contract is
what lets the web and worker lifecycle handlers finish cleanup and emit their
`stopping`/`stopped` evidence.

Do not run the segment loop inside the web process. More than one enabled
worker may duplicate provider reads even though membership reconciliation is
idempotent.

## Required deployment metadata

- `SERVICE_NAME`: use `easygo-web` or `easygo-segment-worker` per service.
- `RELEASE_SHA`: immutable deployed commit identifier.
- `NODE_ENV=production` and `LOG_LEVEL=info`.
- `READINESS_TIMEOUT_MS=2000` for the web service.
- `SHUTDOWN_TIMEOUT_MS=10000` for the web service.

For every completed web rollout, bind `RELEASE_SHA` to the Railway deployment
ID, immutable image digest, and release archive SHA-256 in
[`DEPLOY_CHECKLIST.md`](./DEPLOY_CHECKLIST.md). Promote it to the rollback
baseline below only after exact-release smoke verification and the required
stabilization window.

The existing database, Privy, provider, consent, and phase configuration still
applies. S9 never applies a migration during web/worker startup.

## Staging preflight and migration

Before any Railway write, run `railway status --json` and verify the project and
environment are the dedicated EasyGo staging targets. The local CLI may be
linked to an unrelated project; never infer the target from the repository
name.

From `backend/`, use:

```bash
npm run preflight:staging
npm run prisma:status
npm run prisma:deploy
npm run prisma:status
```

`preflight:staging` prints variable names and pass/fail state only, never secret
values. It requires core database/Privy/Squid/admin/release configuration,
validates enabled-feature dependencies, blocks accidental social retirement,
and checks optional telemetry pairs.

Run `prisma:deploy` once from a controlled release shell/job after a backup. Do
not attach it to both web and worker startup. The committed Path C migration
adds enums, nullable/defaulted User fields, eight tables, indexes, and foreign
keys; it contains no drop, truncate, delete, or data rewrite.

After deploy, set `EASYGO_BASE_URL` and `EXPECTED_RELEASE` in the operator shell
and run `npm run smoke`. The smoke runner performs GET requests only against
`/health`, `/ready`, and `/social/status`, requires HTTPS for remote targets,
and verifies request correlation and active social mode.

## Staging backup and recovery

The approved EasyGo staging recovery path uses the repository's encrypted
PostgreSQL backup script. Railway-native backup/PITR availability was not used
as recovery evidence for the 2026-08-27 rollout. From `backend/`, run:

```bash
npm run backup:staging
```

The script refuses to run unless the linked Railway project, `staging`
environment, Postgres service, ready volume, and mount path match the IDs in
this runbook. It streams a PostgreSQL custom-format dump through AES-256-CBC
encryption, stores the random passphrase in macOS Keychain, and never writes a
plaintext dump. It then decrypts in memory to verify the `PGDMP` header and
exact byte count. Encrypted files and metadata live in the Git-ignored
`.secure-backups/` directory with owner-only permissions.

The latest verified pre-migration recovery point is
`easygo-staging-20260827T144105Z.dump.enc`, created at
`2026-08-27T14:41:05.090Z`, with SHA-256
`5329c39e6cfc3b053bf7238a75458fdeef49b206e9ab9fd328c07973ef6c885d`.
The sandbox could read but not create a macOS Keychain item, so adjacent
metadata truthfully records `keyReused=true` for the existing Keychain-held
backup key. No passphrase was printed or written. The ciphertext was decrypted
directly into an isolated PostgreSQL 18 database with no plaintext dump file;
the restored `User=5`, `Post=12`, `PostReport=0`, and seven completed migration
receipts matched the source snapshot. The isolated database was then dropped
and its absence rechecked. Keep the encrypted file and adjacent JSON metadata
together. Earlier verified recovery points remain historical evidence.

For a recovery drill, retrieve the passphrase privately from macOS Keychain,
verify the encrypted file's SHA-256 against its metadata, and decrypt directly
into PostgreSQL 18 `pg_restore`. Restore into a new isolated database—not the
live staging database—then verify migrations and representative row counts.
Only after that drill passes should a separate reviewed incident procedure be
allowed to replace live data.

## Optional telemetry activation

Leave all four provider values blank until privacy/vendor approval. Blank
values are a supported configuration, not an error.

### Sentry

- `SENTRY_DSN`: server-side project DSN.
- `SENTRY_ENVIRONMENT`: `staging` or `production`.
- `SENTRY_RELEASE`: normally the same immutable value as `RELEASE_SHA`.
- `SENTRY_TRACES_SAMPLE_RATE`: default `0`; values are capped at `0.2`.

The integration sends errors without default PII or local variables. It removes
user context, request headers/cookies/bodies/query strings, and URL queries.
Never add wallet, Privy, email, consent, answer, proof, or advertiser-key data
as tags or custom context.

Moderation credential-shaped text is sanitized from request and breadcrumb
URLs independently of the Pino HTTP path. Any request ID containing that shape
is replaced with a server UUID. Sentry's `beforeSend` and `beforeBreadcrumb`
paths recursively redact it from enumerable error-event/breadcrumb strings,
including event, exception, stack-path, and breadcrumb text, while the existing
request-field removal remains in force. `beforeSendTransaction` applies the same
recursive sanitizer to performance transaction/span strings, with regression
coverage. Retain a value-safe exact-release staging check.

### Better Stack

- `BETTER_STACK_SOURCE_TOKEN`: unique source token for this service.
- `BETTER_STACK_INGESTING_HOST`: source-specific ingesting host.

Set both or neither. Pino always writes JSON to stdout in production and adds
the Better Stack transport only when both are present. Use a different source
token for web and worker so alerts and retention can differ.

## Probes

`GET /health` proves only that the Node process can answer HTTP. A normal body
contains `status: "alive"`, service, phase, release, and uptime. It never calls
the database.

`GET /ready` normally runs `SELECT 1` with a bounded response deadline. In a
future activation-capable process where both moderation gates are selected, it
instead runs the exact bounded moderation catalog contract described above after
validating the complete operating configuration. A normal body contains
`status: "ready"`. Database/catalog failure, mismatch, or timeout returns `503`,
`Retry-After: 5`, a request ID, and no provider/database error detail.

Both responses use `Cache-Control: no-store`. External uptime monitoring may
check `/health`; Railway traffic readiness must check `/ready`.

## Logs and request correlation

Clients may send `X-Request-Id` containing 8–128 conservative ASCII
characters. Invalid/missing values are replaced with a UUID. The response
returns the selected ID.

HTTP logs contain method, path without query, status, duration, and request ID.
Authentication/cookie/admin headers, SIWE messages/signatures, quiz answers,
emails, Privy IDs, and wallet addresses are redacted before stdout or remote
transport. The request URL sanitizer also removes moderation-key-shaped path
material. Any request ID containing that credential shape is replaced with a
server UUID, including an embedded occurrence.

## Alert baseline

- Page when `/ready` fails for two consecutive checks while `/health` is live.
- Page on any web or enabled-worker fatal error event.
- Warn when web 5xx responses exceed 2% for five minutes with at least 20
  requests.
- When `SEGMENTS_ENABLED=true`, warn when no `segment worker cycle completed`
  event appears for twice `SEGMENT_WORKER_INTERVAL_MS`.
- Warn before provider or database credentials expire; do not log their values.

Tune thresholds after two weeks of staging/production traffic. Dormant worker
logs are expected while the S5 flag is false and must not alert.

## Graceful restart drill

1. Confirm `/health` and `/ready` are `200` and note the release value.
2. Send `SIGTERM` through the hosting platform.
3. Confirm the web process logs one stopping event, stops accepting traffic,
   disconnects Prisma/Telegram, flushes telemetry, and logs one stopped event.
4. With S5 enabled in an approved environment, repeat for the worker and
   confirm the active loop aborts before the process exits.
5. Confirm the replacement instance reports the expected release and `ready`.

## Incident triage

1. If an operational command prints credential material, stop the query, do
   not copy the value, preserve only a restricted incident reference, and
   begin the transcript-access and credential-disposition workflow in
   [`SECRET_ROTATION_RUNBOOK.md`](./SECRET_ROTATION_RUNBOOK.md).
2. Compare `/health` and `/ready` to separate process from database failure.
3. Search by release, service, and request ID. Do not request a user's token,
   SIWE signature, or private wallet/account data for debugging.
4. Check the database and relevant provider status from their official status
   surfaces.
5. Disable only the affected optional feature flag when possible. Existing
   defaults keep S4–S7 off and S8 social mode active.
6. Record the first bad release, error group, scope, and recovery time.

## Rollback

Roll back web and worker independently. The legacy swap execution brake is
deployed, so every eligible web target must contain
`SWAP_EXECUTION_READY=false`; never choose a pre-gate revision that would
reopen `/swap/quote` or `/swap/log`. If only telemetry is unhealthy, remove its
credentials and restart; core API behavior remains available. If the worker is
unhealthy, set `SEGMENTS_ENABLED=false` or scale that service to zero without
stopping the web API. Do not down-migrate the additive S2 schema during
incident response; the previous app can ignore the new tables/nullable
columns. Never use `npm audit fix --force` during incident response.

### Minimum safe web rollback baseline

This table records the minimum safe reviewed source/archive floor. It does not
assert that the historical Railway deployment remains a runnable rollback
snapshot.

| Field | Verified value |
| --- | --- |
| Effective after | `2026-08-24T20:31:56Z` |
| Release SHA | `0600f24d7b706aefb1a5215be559b7640d36a3e2` |
| Railway deployment receipt | `10ba0998-ca2d-429b-8a94-527b4db47ab0` |
| Current snapshot availability | `REMOVED`; no runnable rollback snapshot verified |
| Image digest | `sha256:3a04c35286a2b51fde7009edfbfa4f86f78fcf98eb1f44872434b48a9035bc01` |
| Release archive SHA-256 | `2c4319485d27b2af7728c590f6daccf75af2b5b35c87efb085e8b5daf6d0416a` |
| Scope | Web only; worker and Postgres unchanged |
| Evidence | [PR #58 staging rollout](./DEPLOY_CHECKLIST.md#pr-58-railway-staging-web-rollout-2026-08-24-utc) |

Do not use source below this floor. Because its Railway deployment is removed,
do not assume an executable rollback exists; keep the gate closed and prepare
an exact reviewed-source redeploy or forward-fix under separate approval. The
newer `69bf0bb` rollout and Report smoke are recorded release evidence. The
still newer `48bc35f` rollout proves the additive moderation
migration, gate-off route isolation, exact-release smoke, and a 15-minute
stabilization window, but `POST_MODERATION_READY=false` remains source-enforced
and no real moderation decision has occurred. Neither newer receipt silently
promotes the operator source floor or creates a runnable rollback snapshot;
promotion requires all pre-promotion prerequisites in the moderation runbook,
including exact staging evidence for that candidate release, to pass before a
separate reviewed decision. Runtime activation remains a later separate
approval.

## Pre-production checklist

- `npm test` passes, with only the database-backed SIWE test skipped when no
  approved test database exists.
- The moderation candidate's CI job provisions disposable PostgreSQL, applies
  migrations, and runs its database integration suite without a skip; retain
  those exact receipts for an activation-capable SHA.
- `npx expo-doctor` passes from the app root.
- Android and iOS static exports pass from the app root.
- S2 additive migration has been reviewed and applied to an approved database.
- Privacy/terms and telemetry subprocessor approval are complete.
- Separate web/worker services, `/ready`, alerts, and rollback drill are tested.
- Legacy Squid, Telegram, and Privy/Solana audit findings have an approved
  remediation or launch exception.
- Every item in [`DEPLOY_CHECKLIST.md`](./DEPLOY_CHECKLIST.md) is checked with
  evidence for the exact release SHA.
