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
- [x] Reproduce build 96 through stage 4 on the affected iPhone 16 Pro Max.
      JSC on iOS 26.5 remains alive through `client.initialize()` and the
      standalone WebView native load. The visible `STARTUP-PRIVY-05` is caused
      by the diagnostic's blocking `ping(5000)`, which the official Privy
      WebView does not use for initial readiness.
- [x] Complete, inspect, and submit iOS build `2.0.2 (97)`. EAS build
      `53e28492-108b-455d-bd3f-ca38b6f3909c` came from exact commit `216763a`;
      submission `d5f0bebc-7156-41ef-a2c6-cfe463146d7a` succeeded, and App
      Store Connect build `51d84fef-c246-4f72-b4a7-b74b718dacd6` is `VALID`.
      The inspected IPA links JavaScriptCore, matches the clean exported bundle,
      and contains neither Hermes nor QuickBase64.
- [x] Device-test build 97 through the official Provider readiness gate and
      keep the EasyGo login screen open on the affected iPhone 16 Pro Max. All
      five startup gates pass on JSC/iOS 26.5 and the branded login UI renders
      without a process exit. Real OAuth and `/auth/sync` remain unchecked
      below.
- [x] Complete Apple OAuth, embedded-wallet creation, authenticated
      `/auth/sync`, and one idempotent 100 Orange welcome reward on the affected
      iPhone through Builds 98 and 99. Build 100 adds fail-closed provider
      `eth_chainId`/`eth_accounts` attestation and public wallet-address privacy;
      EAS build `c545d16a-7237-456c-8efe-53641e2a7286`, submission
      `370b5cb0-cf9f-4b7c-b572-4e03cc3018a9`, and App Store Connect processing
      all succeeded. Physical-device Base badge verification remains open.

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
  Candidate `2026-08-10-staging-v1` now has versioned backend routes and a
  fail-closed client/server contract, documented in
  [`../../docs/LEGAL_CONSENT_RELEASE.md`](../../docs/LEGAL_CONSENT_RELEASE.md).
  It remains review-only: `CONSENT_GRANTS_ENABLED=false`, its manifest says
  `publishedForConsent=false`, and the operator/legal approval blockers are
  intentionally open.
- [ ] Approve or remediate the remaining Squid, Privy/Solana, and Expo audit
  findings; never use `npm audit fix --force` during release.
  The 2026-08-10 backend remediation in PR #23 upgraded
  `node-telegram-bot-api` to 1.2.0 and pinned `brace-expansion` to 2.1.4. It
  reduced backend findings from 26 to 18, high findings from six to five, and
  critical findings from two to zero. The remaining backend findings require a
  reviewed Squid dependency update and migration from deprecated
  `@privy-io/server-auth` to `@privy-io/node`. The current mobile audit reports
  45 findings, including one critical finding in the Expo 51 build-tool chain;
  that framework migration requires a separate native release and device QA.
- [x] Document release SHA `f252761a217094942bc18e57e09467c01a8bc8ba`
  and previous known-good SHA `b1850d0`.
- [x] Confirm an operator is available for the deployment and 15-minute watch.

## Deploy

- [x] Deploy the web service to staging.
- [x] Confirm Railway `/ready` health check becomes healthy.
- [x] Set `EASYGO_BASE_URL` and `EXPECTED_RELEASE`, then run `npm run smoke`.
- [x] Verify one real-device Privy sign-in and `/auth/sync` against staging.
- [x] Verify feed, profile, follow, notification-screen, and Orange balance read
  paths without activating Path C flags. The owner completed the remaining
  follow/unfollow, notification-screen, and refreshed Orange checks on internal
  Build 109 on 2026-08-20; the existing feed/profile session also remained
  intact across Apple sign-out/sign-in.
- [ ] Verify the Squid quote read path without activating Path C flags. Build
  109 cannot exercise it. The next internal candidate adds a separate
  authenticated `/swap/quote-preview` path and Orange-tab preview screen. The
  backend must derive the stored wallet, fix both sides to Base 8453, accept
  only the reviewed ETH/USDC pair, request `quoteOnly`, and return the
  display-only allowlist without `transactionRequest`, calldata, calls, target,
  quote ID, or route params. Do not sign or broadcast a transaction for this
  check; leave this item open until the exact backend/mobile SHA passes device
  QA.
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

### 2026-08-10 Telegram dependency security rollout

- PR #23 merged as `3c7b9bdd316a37f66d2a9405de4a91a9645ef0c5` after
  Backend and Mobile CI passed. The deploy tree exactly matched that merge
  commit and contained no database migration.
- Railway web deployment `dfb0711a-c44a-4c00-82d2-fa4ceb3cf3c1` completed
  with `SUCCESS`; `/health` reported the exact merge SHA and `/ready` passed
  Railway's configured health check.
- Railway worker deployment `85a2ae8a-7f22-4136-a8d8-aaf6be25ce34`
  completed with `SUCCESS` and duration zero, matching the expected dormant
  contract while `SEGMENTS_ENABLED=false`.
- Both services retained `SEGMENTS_ENABLED=false` and report the same
  `RELEASE_SHA`. The read-only smoke passed `/health`, `/ready`, and
  `/social/status`; `/telegram/health` also returned HTTP 200. The immediate
  post-deploy review found no application error logs or HTTP 5xx responses.
- The rollback release remains `f252761a217094942bc18e57e09467c01a8bc8ba`.
  Its last known-good web and worker deployments are
  `97b8294a-767e-4d32-a7f9-df77f1387c83` and
  `e5017999-52ee-4880-931d-d7a641f26e14`, respectively. Extended monitoring
  is not claimed by this immediate smoke record.

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
