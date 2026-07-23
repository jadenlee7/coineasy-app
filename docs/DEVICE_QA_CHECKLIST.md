# EasyGo staging device QA

Use this checklist for the minimal-entrypoint diagnostic TestFlight build
`2.0.0 (91)` and Android preview build `versionCode 64`. Both clients must
target `https://easygo-web-staging-staging.up.railway.app`. Record the device
model, OS version, tester account type, and test time; never record an access
token, wallet private key, or login code.

## iOS readiness

- [x] EAS minimal-entrypoint build `2ec8447d-e3b3-4fc0-abf3-93e79330b68e`
  (build 91) completed on Xcode 26 and App Store Connect submission
  `fef7561f-78f4-41ff-8f60-36a2b97b3e45` was triggered.
- [ ] Confirm App Store Connect lists build `2.0.0 (91)` as `VALID`,
  unexpired, and available to the six-tester `Internal testing` group.
- [ ] Install build 91 from TestFlight on the iPhone 16 Pro Max where builds 86
  through 90 terminated during startup. Builds 86 through 90 are superseded.
- [ ] Record exactly one result: (1) the `최소 부팅 화면 · BUILD 91` screen
  renders, or (2) the app terminates before any screen appears. Build 91
  registers a static React Native screen straight from `entrypoint.js`, so no
  application JS beyond React Native itself evaluates at launch.

## Build 91 decision tree

Native modules initialize at launch through Expo autolinking regardless of
what the JS entry imports, so the two results separate cleanly:

- Result (1) — the minimal screen renders: the launch crash lives in the JS
  application graph that builds 86 through 89 evaluated at startup. Next
  build restores the staged `BootstrapApp` entry (build 90 shape) and then
  re-adds the polyfills and `App` modules one stage at a time through
  `EasyGo 시작`, watching for `STARTUP-MODULE-02`.
- Result (2) — still terminates with no screen: the JS bisection is
  exhausted; the failure is in native initialization. In priority order:
  - Export the newest EasyGo `.ips` file from Settings ▸ Privacy & Security ▸
    Analytics & Improvements ▸ Analytics Data and attach it. The crashing
    frame (Hermes, TurboModule, EXUpdates, or an autolinked pod) selects the
    fix; this is the single most valuable artifact.
  - Install the same build 91 on a non-A18 iPhone from the tester group. The
    crash device is an iPhone 16 Pro Max (A18 Pro), and there is a known
    class of production-only launch crashes on A18 Pro + iOS 26 where
    development builds run normally (expo/expo#44680).
  - Build the `development` profile dev client for the same iPhone 16 Pro
    Max. If it launches, the failure matches the production-only A18 Pro
    signature above.
  - Plan the structural fix: upgrade Expo SDK 51 to the current SDK line
    with first-class Xcode 26 support. Apple rejects pre-iOS-26-SDK uploads
    (build 85 failed with `90725`), so returning to Xcode 16.2 is not an
    option, and SDK 51 predates Xcode 26; further entrypoint changes cannot
    fix a native-level incompatibility.

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
- [ ] If build 91 terminates before the minimal screen appears, export the
  newest EasyGo analytics `.ips` file from the iPhone and follow the
  `Build 91 decision tree` above before requesting any further build.
- [ ] After the checklist passes, mark the matching items in
  `backend/docs/DEPLOY_CHECKLIST.md`; keep all Path C feature flags off until
  the privacy and security gates are separately approved.
