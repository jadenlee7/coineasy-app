# EasyGo staging device QA

Use this checklist for the staged-startup diagnostic TestFlight build
`2.0.0 (92)` and Android preview build `versionCode 64`. Both clients must
target `https://easygo-web-staging-staging.up.railway.app`. Record the device
model, OS version, tester account type, and test time; never record an access
token, wallet private key, or login code.

## iOS readiness

- [x] Build 91 (minimal static entrypoint, EAS build
  `2ec8447d-e3b3-4fc0-abf3-93e79330b68e`) rendered `최소 부팅 화면 · BUILD 91`
  on the iPhone 16 Pro Max where builds 86 through 90 terminated. The native
  layer — RN 0.74.5 under Xcode 26, every autolinked native module's init,
  and the A18 Pro device class — is therefore cleared. The remaining crash
  site is the JS application graph that builds 86 through 89 evaluated at
  startup. Builds 86 through 91 are superseded.
- [ ] Trigger EAS build 92 (staged `BootstrapApp` entry restored, with
  per-stage failure labels and an env-presence line) and submit it to
  TestFlight.
- [ ] Confirm App Store Connect lists build `2.0.0 (92)` as `VALID`,
  unexpired, and available to the six-tester `Internal testing` group.
- [ ] Install build 92 from TestFlight on the same iPhone 16 Pro Max.
- [ ] Confirm `STARTUP DIAGNOSTIC · BUILD 92` appears, then record the `ENV`
  line exactly as shown (it reports `O`/`X` presence for
  `PRIVY_APP_ID`, `PRIVY_CLIENT_ID`, and `BACKEND_URL` as inlined into this
  bundle — an `X` means the EAS `production` environment did not carry that
  variable at build time, itself a prime crash candidate).
- [ ] Tap `EasyGo 시작` once and record exactly one result: the normal EasyGo
  app, `STARTUP-MODULE-02` (include the `stage` label naming the module that
  failed), `STARTUP-JS-01`, or an immediate termination.

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
- [ ] If build 92 shows `STARTUP-MODULE-02`, the `stage` label names the
  failing module; capture the full visible message and a screenshot. If it
  terminates after `EasyGo 시작` without a visible error, export the newest
  EasyGo analytics `.ips` file from the iPhone. Termination before the
  diagnostic screen would contradict the build 91 result and warrants a
  re-test of build 91 first.
- [ ] After the checklist passes, mark the matching items in
  `backend/docs/DEPLOY_CHECKLIST.md`; keep all Path C feature flags off until
  the privacy and security gates are separately approved.
