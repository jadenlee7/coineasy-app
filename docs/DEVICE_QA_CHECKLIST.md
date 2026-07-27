# EasyGo staging device QA

Use this checklist for the staged-startup diagnostic TestFlight build `2.0.0
(94)` and Android preview build `versionCode 64`. Both clients must target
`https://easygo-web-staging-staging.up.railway.app`. Record the device model,
OS version, tester account type, and test time; never record an access token,
wallet private key, or login code.

## iOS readiness

- [x] Build 92 reached the protected configuration screen on the affected
  iPhone, proving the minimal React Native boot and application module graph
  could render. Its release bundle did not inline the two public Privy IDs.
- [x] EAS build 93 `281c72d3-e232-4202-8e11-92a58498c2d3` switched Metro to
  `babel-preset-expo`; its IPA contains the public Privy IDs and backend URL.
  Submission `7ed1bbba-35f1-4200-9df8-b5b90f7d0d55` finished successfully,
  and App Store Connect reports `2.0.0 (93)`
  (`e285c8cd-5df9-4e3c-a3d5-593076921db8`) as `VALID`.
- [x] Build 93 still terminated on the iPhone 16 Pro Max after advancing into
  the configured Privy startup path. App Store Connect currently has no
  tester-submitted crash log for that build.
- [ ] Confirm the replacement build 94 EAS build and App Store Connect
  submission IDs are recorded here before device testing.
- [ ] Install build 94 from TestFlight on the affected iPhone 16 Pro Max.
- [ ] Confirm `STARTUP DIAGNOSTIC · BUILD 94` appears before tapping anything.
- [ ] Tap `Privy 단계 진단 시작` once. If the app terminates, reopen it and
  capture the `마지막 기록` row before tapping again.
- [ ] If `PRIVY PROBE · BUILD 94` reaches `Privy 준비 완료`, tap
  `EasyGo 본체 열기` and confirm the EasyGo login screen remains open.
- [ ] Expect one signed-out session on build 94. Authentication stays in iOS
  SecureStore but uses a new versioned EasyGo namespace so a stale pre-fix
  Privy session is not restored.

## Android readiness

- [x] Crash-fix preview build `868e27b8-65e2-4b25-81cb-ecd0a955d55f`
  (`versionCode 64`) completed with Node 20.19.4. Its 112,415,230-byte APK
  passed full archive integrity verification; SHA-256 is
  `fa8fe54e1889378db4872ed12857e92ef454997eefcbfa3890bee2923f61ab82`.
- [ ] Install versionCode 64 on a physical Android device. Do not test the
  superseded versionCode 63 APK: it packaged successfully but crashed at
  startup when `AuthBridge` wrote through a context outside its provider.

## Core flow

- [ ] Cold-launch EasyGo twice; the splash and login/feed screen render without
  a crash, blank screen, configuration warning, or `STARTUP-JS-01` safe-mode
  screen.
- [ ] Complete one configured Privy sign-in. Returning to EasyGo through the
  `coineasyapp` scheme succeeds and the session survives an app restart.
- [ ] Confirm the signed-in profile loads. For a brand-new staging user, confirm
  the welcome Orange entry appears once only; do not expect it again on relogin.
- [ ] Load the home feed, open one post/thread, and paginate or refresh once.
- [ ] Publish one clearly labelled staging text post, edit it, and delete it.
- [ ] Open another staging profile, follow then unfollow it, and confirm both
  profile counts and state update.
- [ ] Open Notifications and confirm the screen loads without an auth or server
  error. Where a second tester is available, confirm one follow/like/reply event.
- [ ] Open the Orange balance/history and confirm both return consistently after
  a refresh. Claim only a staging-safe idempotent reward already exposed by the
  UI; do not spend or transfer real assets.
- [ ] Request one Squid quote and verify amount, source, destination, fee, and
  route render. Stop before signing or broadcasting a transaction.
- [ ] Open `coineasyapp://` from Safari or Notes and confirm EasyGo foregrounds.
- [ ] Sign out, sign in again, and confirm profile/feed/Orange data persist.

## Pass and failure handling

- [ ] `/auth/sync`, feed, profile, follow, notifications, Orange, and quote paths
  all pass without repeated `401`, `404`, `5xx`, or loading loops.
- [ ] No token, email, Privy ID, wallet address, signature, or login code appears
  in an on-screen error or application log.
- [ ] Record failures with build number, device/OS, UTC time, screen, exact user
  action, and screenshot. Do not include credentials or private wallet data.
- [ ] If build 94 shows `STARTUP-STAGE-03`, `STARTUP-PRIVY-04`, or
  `STARTUP-JS-01`, capture the full visible message and a screenshot. If it
  terminates, reopen once and capture `마지막 기록`; also export the newest
  EasyGo analytics `.ips` file from the iPhone when available.
- [ ] After the checklist passes, mark the matching items in
  `backend/docs/DEPLOY_CHECKLIST.md`; keep all Path C feature flags off until
  the privacy and security gates are separately approved.
