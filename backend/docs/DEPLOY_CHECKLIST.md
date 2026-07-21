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
| Web | `easygo-web-staging` | `518ba3f5-486b-42a4-ad0c-27fb56e63b00` | Deployed; running |
| Worker | `easygo-worker-staging` | `0ffb8648-fe59-4fb7-926f-3cc9445c133d` | Deployed; dormant flag-off exit verified |

The project's default `production` environment is empty. All three service
instances and the database volume exist only in `staging`. Web is running the
approved release at `https://easygo-web-staging-staging.up.railway.app`.
Worker uses the same release and exits cleanly while `SEGMENTS_ENABLED=false`.

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
- [x] Track the root `package-lock.json`, use `npm ci` for Mobile CI, remove the
      unused `install`/`npx` dependency chain, and update `viem` within Privy's
      supported range. A clean install, Android export, and Expo Doctor pass.
- [ ] Draft PR #17 is reviewed and approved.
- [x] Backend and Mobile CI checks pass on release
      `f252761a217094942bc18e57e09467c01a8bc8ba`.
- [x] Create `@coineasy/easygo`, link EAS project
      `2297c440-2ab1-46d8-8c60-29e74977ed9f`, and configure the public mobile
      variables in `development` and `preview`.
- [ ] Complete Android preview APK build
      `cb8347ca-8462-4ea9-a38c-07deb29e8ad3`; it is currently in the Expo queue.

## Pre-Deploy

- [x] Link Railway CLI to the dedicated `easygo-app-staging` project and its
  `staging` environment; verify the IDs against the inventory above.
- [x] Create separate empty `easygo-web-staging` and
  `easygo-worker-staging` service shells.
- [x] Connect both service shells to the same approved revision with `backend/`
  as their root directory.
- [x] Set the web config path to `/backend/railway.web.json` and worker config
  path to `/backend/railway.worker.json`.
- [x] Configure non-secret safe defaults without triggering a deployment:
  production runtime, service metadata, Postgres reference, public Privy App
  ID, active legacy social mode, and all Path C feature flags off.
- [x] Configure the remaining staging values. The deployed web service's
  value-safe preflight passes with zero failures; optional Sentry, Better Stack,
  and Telegram integrations remain warnings rather than release blockers.
- [x] Configure the Expo/EAS `EXPO_PUBLIC_BACKEND_URL` to the staging HTTPS URL
  and pass the root `npm run preflight:staging`.
- [x] In the Privy mobile client, allow iOS
  `com.coineasy.coineasysocial`, Android `com.coineasy.coineasy`, and URL scheme
  `coineasyapp`.
- [x] Review the additive SQL in
  `prisma/migrations/20260721143000_path_c_v2/migration.sql`.
- [ ] Take or verify a recoverable database backup.
- [x] Run `npm run prisma:status` against staging and record existing migration
  state.
- [x] Apply `npm run prisma:deploy` once from a controlled release job, not from
  both web and worker services.
- [x] Re-run `npm run prisma:status`; verify both migrations are applied.
- [x] Keep `SIWE_AUTH_ENABLED`, `JUSTANAME_ENABLED`, `SEGMENTS_ENABLED`,
  `QUESTS_ENABLED`, and `ADVERTISER_ADMIN_ENABLED` false for the first deploy.
- [x] Keep `LEGACY_SOCIAL_MODE=active`.
- [ ] Verify published privacy/terms version equals `EASYGO_CONSENT_VERSION`.
  The linked privacy PDF is an old ThePivot policy effective 2023-08-26, the
  linked terms PDF has no explicit effective date, and the deployed consent
  version does not match that privacy date. Publish matched, EasyGo-branded
  policy documents before enabling any consent-gated Path C feature.
- [ ] Approve or remediate the known Squid, Telegram, and Privy/Solana audit
  findings; never use `npm audit fix --force` during release.
  The 2026-07-21 audit reduced mobile findings from 95 to 36 (one critical)
  without a framework migration. The remainder requires reviewed Expo 51,
  React Native, and Privy upgrades. Backend still reports 25 transitive
  findings (two critical) rooted in Squid, Privy/Solana, and Telegram; npm's
  suggested resolutions are breaking changes and are not approved here.
- [x] Document release SHA `f252761a217094942bc18e57e09467c01a8bc8ba`
  and previous known-good SHA `b1850d0`.
- [x] Confirm an operator is available for the deployment and 15-minute watch.

## Deploy

- [x] Deploy the web service to staging.
- [x] Confirm Railway `/ready` health check becomes healthy.
- [x] Set `EASYGO_BASE_URL` and `EXPECTED_RELEASE`, then run `npm run smoke`.
- [ ] Verify one real-device Privy sign-in and `/auth/sync` against staging.
- [ ] Verify feed, profile, follow, notification, Orange balance, and Squid quote
  read paths without activating Path C flags.
- [x] Deploy the worker service with `SEGMENTS_ENABLED=false` and confirm one
  dormant/start-stop log sequence without a public domain.
- [ ] Exercise `SIGTERM` for web and worker and confirm graceful cleanup.
- [x] Monitor Railway readiness, 5xx responses, and request latency for at
  least 15 minutes.
- [ ] Activate and monitor Sentry and Better Stack before production traffic;
  both remain intentionally unset pending vendor/privacy approval.
- [ ] Only after the baseline is stable, enable one Path C feature in a separate
  reviewed rollout.

## Post-Deploy

- [x] Confirm `/health`, `/ready`, and `/social/status` remain nominal.
- [x] Confirm the deployed release matches `EXPECTED_RELEASE`.
- [x] Confirm database migration status reports no pending migration.
- [x] Confirm logs contain request IDs but no auth header, email, Privy ID,
  wallet, signature, quiz answer, or query string.
- [x] Record staging evidence and exceptions here. Railway recorded one
  transient `/health` 502 at `2026-07-21T20:03:02Z`; there were no further
  web 5xx responses or application error logs in the latest 30-minute review,
  and the current read-only smoke passes all three endpoints.
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
