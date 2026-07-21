# EasyGo backend operations runbook

Status: S9 implementation, additive S2 migration, and the first staging deploy
are complete. The remaining gates are the database backup, matched published
privacy/terms version, security exceptions, real-device login, and rollback
drills.

## Railway staging target

The verified target is project `easygo-app-staging`
(`cad97a26-a680-4b8e-a366-f15b0412244f`), environment `staging`
(`f59e8f5a-406d-410f-a273-0020089860cd`). Its service IDs are:

- Postgres: `16994f70-8e17-47f7-bb50-55ac211af412`
- Web: `518ba3f5-486b-42a4-ad0c-27fb56e63b00`
- Worker: `0ffb8648-fe59-4fb7-926f-3cc9445c133d`

Postgres is running with a ready persistent volume and both migrations applied.
Web is deployed from the reviewed staging branch and serves the public staging
domain with `/ready` healthy. Worker is deployed from the same revision and
exits successfully while `SEGMENTS_ENABLED=false`. The project's default
`production` environment remains empty; do not add services or variables there
during staging work.

Required staging configuration is present and the value-safe deployed preflight
passes with zero failures. Optional Sentry, Better Stack, and Telegram values
remain intentionally unset pending vendor/privacy approval. Never record secret
values in this document or CLI output.

## Process topology

| Process | Command | Public traffic | Safe default |
| --- | --- | --- | --- |
| Web | `npm start` | Express API, `/health`, `/ready` | Starts with all existing feature defaults |
| Segment worker | `npm run worker:segments` | None | Starts then stays dormant when `SEGMENTS_ENABLED=false` |

`Procfile` records the same contracts. On Railway, create two services from the
same commit and `backend/` root. Set the web service config path to
`/backend/railway.web.json` and the worker path to
`/backend/railway.worker.json`. Only the web service receives a public domain;
its health-check path is `/ready`. Scale and roll back the two services
independently.

Do not run the segment loop inside the web process. More than one enabled
worker may duplicate provider reads even though membership reconciliation is
idempotent.

## Required deployment metadata

- `SERVICE_NAME`: use `easygo-web` or `easygo-segment-worker` per service.
- `RELEASE_SHA`: immutable deployed commit identifier.
- `NODE_ENV=production` and `LOG_LEVEL=info`.
- `READINESS_TIMEOUT_MS=2000` for the web service.
- `SHUTDOWN_TIMEOUT_MS=10000` for the web service.

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

`GET /ready` runs `SELECT 1` with a bounded response deadline. A normal body
contains `status: "ready"`. Database failure or timeout returns `503`,
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
transport.

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

1. Compare `/health` and `/ready` to separate process from database failure.
2. Search by release, service, and request ID. Do not request a user's token,
   SIWE signature, or private wallet/account data for debugging.
3. Check the database and relevant provider status from their official status
   surfaces.
4. Disable only the affected optional feature flag when possible. Existing
   defaults keep S4–S7 off and S8 social mode active.
5. Record the first bad release, error group, scope, and recovery time.

## Rollback

Roll back web and worker to the last known-good release independently. If only
telemetry is unhealthy, remove its credentials and restart; core API behavior
remains available. If the worker is unhealthy, set `SEGMENTS_ENABLED=false` or
scale that service to zero without stopping the web API. Do not down-migrate
the additive S2 schema during incident response; the previous app can ignore
the new tables/nullable columns. Never use `npm audit fix --force` during
incident response.

## Pre-production checklist

- `npm test` passes, with only the database-backed SIWE test skipped when no
  approved test database exists.
- `npx expo-doctor` passes from the app root.
- Android and iOS static exports pass from the app root.
- S2 additive migration has been reviewed and applied to an approved database.
- Privacy/terms and telemetry subprocessor approval are complete.
- Separate web/worker services, `/ready`, alerts, and rollback drill are tested.
- Legacy Squid, Telegram, and Privy/Solana audit findings have an approved
  remediation or launch exception.
- Every item in [`DEPLOY_CHECKLIST.md`](./DEPLOY_CHECKLIST.md) is checked with
  evidence for the exact release SHA.
