# EasyGo staging device QA

Use this checklist for the crash-fix TestFlight build `2.0.0 (87)` and Android
preview build `versionCode 64`. Both clients must target
`https://easygo-web-staging-staging.up.railway.app`. Record the device model,
OS version, tester account type, and test time; never record an access token,
wallet private key, or login code.

## iOS readiness

- [x] EAS crash-fix build `ed444075-8f44-44b8-aec6-856c58212d05` completed on
  Xcode 26. App Store Connect submission
  `0f2c073b-79f8-429e-8c10-60b995c7e4e4` completed successfully.
- [x] App Store Connect build `2.0.0 (87)` is `VALID`, unexpired, and available
  to the six-tester `Internal testing` group.
- [ ] Install build 87 from TestFlight on a physical iPhone. Build 86 is
  superseded because the same startup state-provider defect was present.

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
  a crash, blank screen, or configuration warning.
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
- [ ] After the checklist passes, mark the matching items in
  `backend/docs/DEPLOY_CHECKLIST.md`; keep all Path C feature flags off until
  the privacy and security gates are separately approved.
