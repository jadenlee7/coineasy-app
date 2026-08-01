# EasyGo staging device QA

Use this checklist for the staged-startup diagnostic TestFlight build `2.0.1
(96)` and Android preview build `versionCode 64`. Both clients must target
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
- [x] EAS build 94 `97a86043-1a61-4857-a39d-c6482481a013` completed from
  commit `38106ce` on Xcode 26. The downloaded 29,991,195-byte IPA reports
  `2.0.0 (94)`, the expected bundle ID and URL scheme, and contains all public
  release values plus the persistent startup probe. SHA-256 is
  `57b091207f3bc92eed8b27fd55d397d40828a6c15a51e05295b9b6af309dec71`.
- [x] EAS submission `ce442d06-f1f0-4371-9506-226472516582` finished
  without an error. App Store Connect marks build 94
  (`f7d1a1ed-24b0-473c-82ac-2aaec98328c3`) `VALID`; Apple currently reports
  zero matching beta crash-feedback submissions and no diagnostic signature.
- [x] The affected iPhone 16 Pro Max still terminates while using build 94.
  Apple has not received a matching tester crash report, and the exact
  persisted startup marker was not captured before build 95 was prepared.
- [x] EAS build 95 `8c0a204c-36c8-4f27-8f01-6e9c5966de2b` completed from
  commit `a4fd7be` on Xcode 26. The downloaded 29,997,235-byte IPA reports
  `2.0.0 (95)`, the expected identifier and URL scheme, contains all three
  public release values and every v95 diagnostic marker, and has SHA-256
  `96bedd0695266e88049d29e0f01ea26c74f92b29e6586a67e8d47ec57255005c`.
- [x] EAS submission `f9106ab4-5459-4ec9-86de-8aa0caf7bebf` finished
  without an error. App Store Connect marks build 95
  (`586e5396-157a-43a6-a5c5-41e930e3ba1b`) `VALID`; Apple currently reports
  zero matching beta crash-feedback submissions and no diagnostic signature.
- [x] Install build 95 from TestFlight on the affected iPhone 16 Pro Max.
- [x] Confirm `STARTUP DIAGNOSTIC · BUILD 95` appears before tapping anything,
  then tap `Build 95 단계 진단 열기`.
- [x] The storage roundtrip and client construction steps pass. On the
  affected device, tapping `3단계 · initialize만 실행` terminates build 95
  before the standalone WebView or Provider is mounted. The supplied screen
  records `Privy client 객체 생성 · 통과` at `2026-07-30T20:57:51.609Z`.
- [x] Recheck App Store Connect after the build 95 reproduction. Apple still
  reports zero matching beta crash-feedback submissions and no diagnostic
  signature, so no `.ips` termination stack is remotely available.
- [x] Complete, inspect, submit, and process iOS compatibility build `2.0.1
  (96)`. EAS build `d0a50681-01cf-4909-a5fc-d25f7026ba22` was created from
  exact commit `5cf7a82`; submission
  `4b2e3597-0466-46b7-bb02-ff77c292c605` finished without an error, and App
  Store Connect marks build resource
  `0af9db65-98b4-4200-adf1-a68b516adb1d` `VALID`.
- [x] Verify the 27,023,318-byte IPA with SHA-256
  `b492a3ca671118ed64f95e3df318d926a1ed3081741c2455e1681f6a66361ea9`.
  The native executable links JavaScriptCore; no Hermes archive path or
  `QuickBase64` code is present. Runtime `2.0.1`, all three public release
  values, both v96 keys, the expected identifier, and URL scheme are present.
- [ ] Install build 96 from TestFlight on the affected iPhone 16 Pro Max and
  rerun storage, client creation, initialize, standalone WebView, and Provider
  one button at a time.
- [ ] After `5/5 · Provider 준비 완료`, tap `EasyGo 본체 열기` and confirm
  the EasyGo login screen remains open.
- [ ] Confirm the expected session state. Build 95 to 96 preserves the same
  versioned `easygo-privy-v2-` SecureStore namespace; only upgrades from a
  pre-build-94 client should require the one-time sign-in again.

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
- [ ] If build 96 shows `STARTUP-STAGE-03`, `STARTUP-PRIVY-05`, or
  `STARTUP-JS-01`, capture the full visible message and a screenshot. If it
  terminates, reopen once and capture `마지막 기록`; also export the newest
  EasyGo analytics `.ips` file from the iPhone when available.
- [ ] After the checklist passes, mark the matching items in
  `backend/docs/DEPLOY_CHECKLIST.md`; keep all Path C feature flags off until
  the privacy and security gates are separately approved.
