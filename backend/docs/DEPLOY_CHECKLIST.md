# Deploy Checklist: EasyGo Path C staging release

**Date:** 2026-07-21 | **Deployer:** jadenlee7

This checklist is staging-first. Production remains blocked until the staging
database, device login, security exceptions, privacy copy, and rollback drill
are approved.

## Railway staging inventory

Verified on 2026-07-21 without printing secret values:

| Resource | Name | ID | State |
| --- | --- | --- | --- |
| Project | `easygo-app-staging` | `cad97a26-a680-4b8e-a366-f15b0412244f` | Dedicated project |
| Environment | `staging` | `f59e8f5a-406d-410f-a273-0020089860cd` | Linked locally |
| Database | `Postgres` | `16994f70-8e17-47f7-bb50-55ac211af412` | Running; volume ready |
| Web | `easygo-web-staging` | `518ba3f5-486b-42a4-ad0c-27fb56e63b00` | Empty; not deployed |
| Worker | `easygo-worker-staging` | `0ffb8648-fe59-4fb7-926f-3cc9445c133d` | Empty; not deployed |

The project's default `production` environment is empty. All three service
instances and the database volume exist only in `staging`. Web and worker have
no repository source, deployment, public domain, or active replica yet.

## Current automated evidence

- [x] Backend tests pass locally (86 pass, one DB-backed SIWE test skipped).
- [x] Expo Doctor passes 17/17 checks.
- [x] Android and iOS static exports complete.
- [x] Mobile preflight tests pass and detect a disconnected backend URL.
- [x] Default-off segment worker starts dormant and exits cleanly.
- [x] Path C migration SQL is generated from the committed social schema and
  statically checked to contain all eight S2 tables and no destructive SQL.
- [x] Read-only `/health`, `/ready`, and `/social/status` smoke runner exists.
- [x] Changes are committed to `agent/easygo-path-c-staging-release` and
  published in draft PR #17.
- [x] GitHub Actions is configured to run backend tests, Prisma validation,
  local preflights, Expo Doctor, and Android/iOS static exports on the PR.
- [ ] Draft PR #17 is reviewed and approved.
- [ ] CI checks run and pass on that exact revision.

## Pre-Deploy

- [x] Link Railway CLI to the dedicated `easygo-app-staging` project and its
  `staging` environment; verify the IDs against the inventory above.
- [x] Create separate empty `easygo-web-staging` and
  `easygo-worker-staging` service shells.
- [ ] Connect both service shells to the same approved revision with `backend/`
  as their root directory.
- [ ] Set the web config path to `/backend/railway.web.json` and worker config
  path to `/backend/railway.worker.json`.
- [x] Configure non-secret safe defaults without triggering a deployment:
  production runtime, service metadata, Postgres reference, public Privy App
  ID, active legacy social mode, and all Path C feature flags off.
- [ ] Configure remaining staging values. The value-safe preflight currently
  fails only for `PRIVY_APP_SECRET`, `SQUID_INTEGRATOR_ID`, `ADMIN_SECRET`,
  `RELEASE_SHA`, and `EASYGO_CONSENT_VERSION` on both web and worker.
- [ ] Configure the Expo/EAS `EXPO_PUBLIC_BACKEND_URL` to the staging HTTPS URL
  and pass the root `npm run preflight:staging`.
- [ ] In the Privy mobile client, allow iOS
  `com.coineasy.coineasysocial`, Android `com.coineasy.coineasy`, and URL scheme
  `coineasyapp`. The provided client was confirmed only against the iOS-style
  identifier and scheme, so Android requires explicit dashboard verification.
- [ ] Review the additive SQL in
  `prisma/migrations/20260721143000_path_c_v2/migration.sql`.
- [ ] Take or verify a recoverable database backup.
- [ ] Run `npm run prisma:status` against staging and record existing migration
  state.
- [ ] Apply `npm run prisma:deploy` once from a controlled release job, not from
  both web and worker services.
- [ ] Re-run `npm run prisma:status`; verify both migrations are applied.
- [ ] Keep `SIWE_AUTH_ENABLED`, `JUSTANAME_ENABLED`, `SEGMENTS_ENABLED`,
  `QUESTS_ENABLED`, and `ADVERTISER_ADMIN_ENABLED` false for the first deploy.
- [ ] Keep `LEGACY_SOCIAL_MODE=active`.
- [ ] Verify published privacy/terms version equals `EASYGO_CONSENT_VERSION`.
- [ ] Approve or remediate the known Squid, Telegram, and Privy/Solana audit
  findings; never use `npm audit fix --force` during release.
- [ ] Document the release SHA and previous known-good SHA.
- [ ] Confirm an operator is available for the deployment and 15-minute watch.

## Deploy

- [ ] Deploy the web service to staging.
- [ ] Confirm Railway `/ready` health check becomes healthy.
- [ ] Set `EASYGO_BASE_URL` and `EXPECTED_RELEASE`, then run `npm run smoke`.
- [ ] Verify one real-device Privy sign-in and `/auth/sync` against staging.
- [ ] Verify feed, profile, follow, notification, Orange balance, and Squid quote
  read paths without activating Path C flags.
- [ ] Deploy the worker service with `SEGMENTS_ENABLED=false` and confirm one
  dormant/start-stop log sequence without a public domain.
- [ ] Exercise `SIGTERM` for web and worker and confirm graceful cleanup.
- [ ] Monitor readiness, 5xx rate, latency, Sentry, and Better Stack for at
  least 15 minutes.
- [ ] Only after the baseline is stable, enable one Path C feature in a separate
  reviewed rollout.

## Post-Deploy

- [ ] Confirm `/health`, `/ready`, and `/social/status` remain nominal.
- [ ] Confirm the deployed release matches `EXPECTED_RELEASE`.
- [ ] Confirm database migration status reports no pending migration.
- [ ] Confirm logs contain request IDs but no auth header, email, Privy ID,
  wallet, signature, quiz answer, or query string.
- [ ] Record staging evidence and any exceptions in the release notes.
- [ ] Notify the product/support owner that staging is ready for device QA.
- [ ] Close the release only after the monitoring window completes.

## Rollback Triggers

- `/ready` fails twice consecutively while `/health` remains live.
- Web 5xx rate exceeds 2% for five minutes with at least 20 requests.
- Privy login or `/auth/sync` fails twice on a known-good staging device.
- Feed/profile/Orange balance cannot load after one web rollback/restart test.
- Any PII, auth secret, wallet address, signature, or answer appears in logs or
  telemetry.
- A worker fatal error repeats after one restart when the worker flag is on.
- P50/P95 latency has no baseline yet; production approval requires a staging
  baseline and explicit thresholds.

## Rollback Procedure

1. Set newly enabled feature flags back to false; keep social mode active.
2. Roll web and worker back independently to the previous known-good SHA.
3. If only the worker is affected, scale it to zero without stopping the API.
4. Do not down-migrate during incident response. The Path C migration only adds
   nullable/defaulted columns, enums, tables, indexes, and foreign keys, so the
   previous app can run while those additions remain.
5. Re-run the read-only smoke test and preserve logs/error IDs for review.
