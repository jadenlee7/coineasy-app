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
- [ ] Expo Doctor currently passes 15/17 checks. The remaining findings are
      the locally installed EAS CLI and transitive Expo config-package version
      drift; neither is newly introduced by build 94, but both remain explicit
      framework-maintenance debt.
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
- [x] Complete an Android preview APK build. Build
      `cb8347ca-8462-4ea9-a38c-07deb29e8ad3` failed before compilation because
      its default Node 20.19.2 did not satisfy the locked `expo-doctor 1.20.1`
      engine requirement of Node 20.19.4 or newer. The preview profile now pins
      Node 20.19.4; replacement APK build
      `d3e60d71-484d-4c1e-bbde-bc7074c90bbb` completed successfully.
- [x] Confirm TestFlight build `2.0.0 (93)` is `VALID`. Build 94 is the current
      Privy startup replacement and must complete device QA before release. Use
      [`../../docs/DEVICE_QA_CHECKLIST.md`](../../docs/DEVICE_QA_CHECKLIST.md)
      for the physical-device pass.
- [x] Complete and inspect EAS iOS build 94
      `97a86043-1a61-4857-a39d-c6482481a013` from commit `38106ce`.
- [x] Confirm EAS submission `ce442d06-f1f0-4371-9506-226472516582`
      finished without an error and App Store Connect reports build 94
      (`f7d1a1ed-24b0-473c-82ac-2aaec98328c3`) as `VALID`.
- [x] Complete and inspect the five-stage EAS iOS build 95
      `8c0a204c-36c8-4f27-8f01-6e9c5966de2b` from commit `a4fd7be`.
- [x] Confirm EAS submission `f9106ab4-5459-4ec9-86de-8aa0caf7bebf`
      finished without an error and App Store Connect reports build 95
      (`586e5396-157a-43a6-a5c5-41e930e3ba1b`) as `VALID`.
- [x] Reproduce build 95 on the affected iPhone 16 Pro Max. The process exits
      after tapping `client.initialize()`; SecureStore roundtrip and Privy
      client construction are the last passed gated steps, and WebView and
      Provider have not yet been mounted.
- [x] Complete and inspect iOS compatibility build `2.0.1 (96)`
      `d0a50681-01cf-4909-a5fc-d25f7026ba22` from exact commit `5cf7a82`.
      The 27,023,318-byte IPA has SHA-256
      `b492a3ca671118ed64f95e3df318d926a1ed3081741c2455e1681f6a66361ea9`;
      its executable links JavaScriptCore, contains no Hermes archive path or
      `QuickBase64` code, and preserves the three public release values, v96
      markers, URL scheme, and isolated runtime `2.0.1`.
- [x] Confirm EAS submission `4b2e3597-0466-46b7-bb02-ff77c292c605`
      finished without an error and App Store Connect reports build 96
      (`0af9db65-98b4-4200-adf1-a68b516adb1d`) as `VALID`.

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
- [x] Take and verify a recoverable database backup. Railway native backups
  are unavailable on the Hobby plan, so `npm run backup:staging` created the
  encrypted PostgreSQL custom-format backup
  `easygo-staging-20260722T090134Z.dump.enc`. The passphrase is held only in
  macOS Keychain, the file is excluded from Git, and an in-memory decrypt
  verified the header and exact byte count. SHA-256:
  `5817cfafb9a661934de0107362cf59afd25647ee1ba5eb4bc2085708acc78a55`.
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
- [x] Exercise `SIGTERM` for the web process and confirm graceful cleanup.
  Deployment `b9cf11c0-8482-4405-98a2-5b2926af8f19` logged `stopping` and
  `stopped` with reason `SIGTERM` and exit code zero before the replacement
  passed all three read-only smoke checks.
- [x] Confirm the flag-off worker starts dormant, disconnects dependencies, and
  exits with code zero.
- [ ] Exercise `SIGTERM` for an enabled worker only in an approved environment;
  keep `SEGMENTS_ENABLED=false` until the privacy/security gates pass.
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
- [x] Notify the product/support owner that staging is ready for device QA and
  provide the exact TestFlight/device checklist.
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
