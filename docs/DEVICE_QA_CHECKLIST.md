# EasyGo staging device QA

Use this checklist for TestFlight build `2.0.0 (86)` and the replacement
Android preview build. Both clients must target
`https://easygo-web-staging-staging.up.railway.app`. Record the device model,
OS version, tester account type, and test time; never record an access token,
wallet private key, or login code.

## iOS readiness

- [x] EAS build `8d659012-a326-4cd9-9777-8053e0c1e504` completed on Xcode 26.
- [x] App Store Connect build `2.0.0 (86)` is `VALID`, unexpired, and declares
  no non-exempt encryption.
- [x] Build 86 is available to the `Internal testing` group, which contains six
  testers and has access to all builds.
- [ ] Install build 86 from TestFlight on a physical iPhone.

## Android readiness

- [x] Preview build `d3e60d71-484d-4c1e-bbde-bc7074c90bbb` completed after
  pinning the EAS builder to Node 20.19.4.
- [x] The build produced an installable internal-distribution APK for package
  `com.coineasy.coineasy`. The 112,415,363-byte archive passed a full ZIP
  integrity check; SHA-256 is
  `cbc0889b166ed952ce074f0765d7284f2b415cef8009f4d8a7dcc67f651c0695`.
- [ ] Install the APK on a physical Android device.

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
