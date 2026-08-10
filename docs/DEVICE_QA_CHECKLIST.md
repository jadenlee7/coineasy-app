# EasyGo staging device QA

Use this checklist for the internal-only account-isolation TestFlight candidate
`2.0.3 (102)`, its privacy-center predecessor `2.0.3 (101)`, and the existing
Android preview build `versionCode 64`. All clients must target
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
- [x] Install build 96 from TestFlight on the affected iPhone 16 Pro Max and
  rerun the gated startup. The screen reports `JSC · IOS 26.5`; SecureStore,
  client construction, and `client.initialize()` all pass without terminating
  the process. The standalone WebView also reaches native `onLoad`, then the
  diagnostic-only immediate ping returns false at
  `2026-08-01T19:37:23.229Z` and shows `STARTUP-PRIVY-05`.
- [x] Compare that result with installed Privy Expo 0.59.6. Its internal
  WebView marks the proxy loaded directly from `onLoad`; it does not require an
  initial ping. The SDK uses ping only after the app returns to the foreground,
  so the build 96 screen is a probe false negative rather than a process crash.
- [x] Complete, inspect, submit, and process iOS build `2.0.2 (97)`. EAS build
  `53e28492-108b-455d-bd3f-ca38b6f3909c` was created from exact commit
  `216763a`; submission `d5f0bebc-7156-41ef-a2c6-cfe463146d7a` finished
  without an error, and App Store Connect marks build resource
  `51d84fef-c246-4f72-b4a7-b74b718dacd6` `VALID`.
- [x] Verify the 27,023,271-byte Build 97 IPA with SHA-256
  `8edfa5829ee78a22e853ce9181fdcbc528e1e08c066822c93dbf9e5055fd9447`.
  Its plain-JavaScript bundle has SHA-256
  `c6f5b0dfe152ff6812ee3de81cf2eb7b713622cd5c4ad917ad49830f2c23ba72`
  and exactly matches the clean local export. The executable links
  JavaScriptCore; Hermes, QuickBase64, and the obsolete blocking readiness
  error are absent. Runtime `2.0.2`, all three public release values, both v97
  keys, the expected identifier, URL scheme, and Apple Sign In entitlement are
  present.
- [x] Install build 97 from TestFlight on the affected iPhone 16 Pro Max and
  rerun storage, client creation, initialize, standalone WebView, and Provider
  one button at a time. JSC on iOS 26.5 remains alive through all five gates;
  the standalone WebView passes at `2026-08-01T20:26:58.793Z` and Privy
  session initialization passes at `2026-08-01T20:27:07.378Z`.
- [x] After `5/5 · Provider 준비 완료`, tap `EasyGo 본체 열기` and confirm
  the EasyGo login screen remains open. The supplied device evidence shows the
  branded Apple, Google, disabled passkey, and Wallet entry screen rendered
  without a process exit. The Wallet button is still an intentional
  SIWE/WalletConnect placeholder and is not evidence of a completed sign-in.
- [x] Configure both Apple and Google login for the EasyGo Privy mobile client.
  The public app-config response reports both providers enabled, and the
  native identifiers `com.coineasy.coineasysocial` and
  `com.coineasy.coineasy` plus scheme `coineasyapp` remain allowlisted. The
  Sign in with Apple key is scoped to the EasyGo iOS primary App ID; no private
  key content is committed or bundled.
- [x] Complete and submit authentication build `2.0.2 (98)`. EAS build
  `0d066e38-0ebf-464d-a20a-ae365f033f49` was created from exact commit
  `8af34fec27a41037b7d740d7160314db6c45ce26`; EAS submission
  `ead73b34-a9c2-4daf-a713-9664334f0178` finished without an error. App Store
  Connect marks build resource `2a5786df-fd8c-46aa-9a05-0fdbed9240e7`
  `VALID`, with zero matching beta crash-feedback submissions.
- [x] Verify the 27,024,088-byte Build 98 IPA with SHA-256
  `497b0c238f66b90f8bf2a1b7d96b17f52597484bb66e55669bebb6728647b9c9`.
  Its JavaScript bundle exactly matches the clean local export at SHA-256
  `5f74b78a4dbdd26e31ddc78a6918571906ccf65469d2d4773abc22a139ede699`.
  The executable links JavaScriptCore, the app reports `2.0.2 (98)`, and the
  bundle contains the expected public Privy IDs, staging URL, and
  `createOnLogin: all-users` behavior. The Apple signing-key body and key ID
  are absent from the bundle.
- [x] Complete one new Apple sign-in on Build 98. On the affected iPhone 16 Pro
  Max, the OAuth return through `coineasyapp` reached the signed-in EasyGo
  profile without a raw Privy error or process exit.
- [x] Create a new Privy App Secret with owner approval and replace only the
  Railway `easygo-web-staging` value without exposing it. Railway deployment
  `f0ed7ad2-fac3-49dd-b102-8417d62fc948` is `SUCCESS`/`RUNNING`; `/health`,
  `/ready`, and `/social/status` all return HTTP 200. A server-side Privy query
  now succeeds and the most recent Apple user has exactly one embedded EVM
  wallet.
- [x] Complete, inspect, submit, and process authentication-recovery build
  `2.0.2 (99)`. EAS build `3a8dee19-9989-43b6-a8c4-7ecf84717cc4` was created
  from exact commit `6a2277018edf21abe1bb3defa4a53175d2971703`; submission
  `3a7193a1-3eda-42ef-9717-46cc225aa243` finished without an error. App Store
  Connect marks build resource `3f5a6f66-f845-42bd-a2a8-75ce0557be97`
  `VALID`, unexpired, with zero matching beta crash-feedback submissions.
- [x] Verify the 27,025,131-byte Build 99 IPA with SHA-256
  `685f51b527b79a8e50866a19a94d9dba8ecaeb8b6369562494538da47693b258`.
  It reports the expected bundle identifier and build number. Its
  6,042,150-byte plain-JavaScript bundle has SHA-256
  `9272cf160aacbf208533ce8b039b6e4aabb31cbbdd95238a64c4b990d73ea138`,
  exactly matches the clean local iOS export, and contains no Hermes artifact.
- [x] Complete, inspect, submit, and process Base-runtime build `2.0.3 (100)`.
  EAS build `c545d16a-7237-456c-8efe-53641e2a7286` was created from exact
  commit `cb6ac70d922d170fd840f9d2b63e75b4d92a1516`; submission
  `370b5cb0-cf9f-4b7c-b572-4e03cc3018a9` finished without an error. App Store
  Connect marks build resource `c4dbfafd-b4ae-4bd5-8e9d-749a5a5ae0a7`
  `VALID`, unexpired, with zero matching beta crash-feedback submissions.
- [x] Verify the 27,026,884-byte Build 100 IPA with SHA-256
  `886230c44b7eb36d167848b16d263a773933c91d5768d86e33449061bc5a478c`.
  It reports the expected version, build number, bundle identifier, URL scheme,
  preview runtime, and Apple Sign-In provisioning entitlement. Its JSC-linked
  executable contains no Hermes path. The 6,047,517-byte JavaScript bundle has
  SHA-256 `b8efcf91a378fae63b59681ba2ed06a137545745250a450932943f3a705fba3a`
  and exactly matches the clean local iOS export; it contains the Base runtime
  probe and no complete private-key block or App Secret.
- [x] Install Build 100 from TestFlight on the affected iPhone 16 Pro Max and
  confirm two cold launches reach the signed-in EasyGo profile without a crash.
- [x] On 2026-08-02, the owner confirmed Build 100 shows `Base · Connected`,
  copies the own-wallet address from the address control, opens the same address
  on BaseScan from the separate Base badge, and does not expose a wallet address
  on another user's profile. No address or account identifier was recorded.
- [x] Complete, inspect, submit, and process privacy-center build `2.0.3 (101)`
  from exact commit `df34fa58c47478827ad9686155c15f2c1a1dd3fa`.
  EAS build `23cdccca-7197-4594-8bd6-971e8ce792ea` and submission
  `301453fd-7c95-4db0-8308-a78cae7cc558` finished without an error. App Store
  Connect marks build `351afe98-4bc8-482c-87c8-386cc10d6f98` `VALID`,
  `READY_FOR_BETA_TESTING`, and `INTERNAL_ONLY`; external state is
  `NOT_APPLICABLE`.
- [x] Verify the 27,032,891-byte Build 101 IPA with SHA-256
  `88e162b2dae3ef9bdaf58c39597f355ece3bbf05c2ff3e38b3df52a9a900f4a6`.
  It reports the expected version, build number, identifier, URL scheme,
  Apple Sign-In entitlement, production push entitlement, and JSC linkage.
  Its 6,067,878-byte JavaScript bundle has SHA-256
  `3836d8004117de3242a13e844533d7847a396592c27acb9f2ea0ba71c7c88a7c`,
  includes both privacy export scopes, and contains no complete private-key
  block.
- [ ] Complete one new Google sign-in. Its OAuth return through `coineasyapp`
  must succeed without showing a raw Privy error.
- [ ] Confirm the expected session state. Builds 95 through 101 preserve the same
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

- [x] Cold-launch EasyGo twice; the splash and login/feed screen render without
  a crash, blank screen, configuration warning, or `STARTUP-JS-01` safe-mode
  screen.
- [ ] Complete one configured Privy sign-in. Returning to EasyGo through the
  `coineasyapp` scheme succeeds and the session survives an app restart.
- [ ] For a new Apple or Google user, confirm exactly one embedded EVM wallet
  is created, the backend profile stores the same address, and the wallet
  provider reports Base chain ID `0x2105`. On Build 100 or newer, the own
  profile must show `Base · Connected`; tapping the address still copies it,
  while tapping the separate Base badge opens that address on BaseScan. Logout
  and relogin must not create a second address.
- [x] Open another user's profile; its public response and selected-profile UI
  do not expose that user's wallet address.
- [ ] Open another user's search result and confirm its public response and UI
  do not expose that user's wallet address.
- [x] Confirm the signed-in profile loads after the Build 98 Apple OAuth return.
- [x] Complete the post-secret authenticated device retry. Railway recorded one
  `/auth/sync` request with HTTP 200 and no corresponding fatal, unhandled, or
  Privy-configuration log. The new local user matches the Privy identity, its
  stored wallet matches the user's only embedded EVM wallet, and no address is
  recorded in this checklist.
- [x] Confirm the brand-new staging user's welcome Orange entry appears once
  only. Railway has exactly one `WELCOME_BONUS` row bound to that user, its
  delta totals `100`, and the user's full Orange balance is `100`; no manual
  ledger insert or repair was performed.
- [ ] Load the home feed, open one post/thread, and paginate or refresh once.
- [ ] Publish one clearly labelled staging text post, edit it, and delete it.
- [ ] On that post, open the overflow menu and confirm Edit/Delete appear for
  the signed-in author, while another account sees only Report/Block/Hide/Mute.
- [ ] Type text, attach media, and select a category in the composer; cancel it,
  immediately open a new post/reply composer, and confirm no prior draft flashes
  or survives into the new presentation.
- [ ] Open another staging profile, follow then unfollow it, and confirm both
  profile counts and state update.
- [ ] Share the own-profile QR/link and open its `coineasyapp://user?userId=…`
  URL both while EasyGo is ready and from a cold launch. It must navigate to
  that public EasyGo profile without exposing or interpreting a Privy DID.
- [ ] Open Notifications and confirm the screen loads without an auth or server
  error. Where a second tester is available, confirm one follow/like/reply event
  and that tapping a post event opens the matching PostDetails route.
- [ ] Open the Orange balance/history and confirm both return consistently after
  a refresh. Claim only a staging-safe idempotent reward already exposed by the
  UI; do not spend or transfer real assets.
- [ ] Request one Squid quote and verify amount, source, destination, fee, and
  route render. Stop before signing or broadcasting a transaction.
- [ ] Open `coineasyapp://` from Safari or Notes and confirm EasyGo foregrounds.
- [ ] Sign out, sign in again, and confirm profile/feed/Orange data persist.

## Build 101 privacy-center candidate

- [x] Confirm App Store Connect labels Build 101 `Internal`. The authoritative
  API reports `buildAudienceType=INTERNAL_ONLY` and external state
  `NOT_APPLICABLE`. This binary must
  remain unavailable to external TestFlight groups and the App Store review
  build picker; absence of the label is a release stop.
- [x] Open Settings after backend profile sync. It shows the server consent
  version and keeps personalization/marketing off without exposing raw API data.
- [x] Until versioned EasyGo Terms and Privacy HTTPS documents are configured,
  consent editing stays locked and the app clearly reports that policy
  publication is pending. Railway `CONSENT_GRANTS_ENABLED` remains `false`;
  a previously stored opt-in can still be revoked.
- [x] On 2026-08-02, the owner completed both the full EasyGo JSON and legacy
  social JSON export/share actions from Build 101 on the affected iPhone 16 Pro
  Max. Both returned without a crash or visible error; no exported file,
  account identifier, or payload content was retained in this checklist.
- [ ] Export the full EasyGo JSON on iOS, inspect `schemaVersion`,
  `scope=easygo_local_database`, and `exportedAt`, then confirm the temporary
  cache file is gone after success, cancellation, and share failure.
- [ ] Export the social JSON and confirm
  `scope=easygo_legacy_social`; it must omit Privy IDs, wallet addresses,
  consent, Orange history, swaps, quests, and segment records.
- [ ] Repeat both exports offline. The UI shows fixed PII-free retry copy and
  never copies JSON to the clipboard or logs the response/error body.
- [ ] On Android, verify the Storage Access Framework folder picker saves both
  JSON files and cancelling the picker creates no file.
- [x] Confirm account deletion is visibly unavailable while Railway
  `ACCOUNT_DELETION_ENABLED=false`; full/social exports and sign-out must remain
  usable. Do not execute deletion on the primary tester account.

## Build 102 account-isolation candidate

- [x] EAS build `a07e8c29-721c-4c3d-b953-d62bf86e588a` completed from exact
  clean commit `0b526cb2984131dcd865b40a0a5d7a7d63de12c0` with the `testflight`
  profile, `preview` channel, and staging target. The 27,044,813-byte IPA has
  SHA-256 `5a3dddf784fe0dcf057d33c345d178edf051e68f7b48f27f5bc35ade8df8ce58`
  and reports `2.0.3 (102)`, `com.coineasy.coineasysocial`, and `coineasyapp`.
  Its JSC bundle exactly matches the clean local export at SHA-256
  `dc0576e272e6293df4fe1c743ead193340e3b1497d2252f0e78b1b6bed4a72f6`;
  the expected public runtime values are present and no private-key payload is
  bundled.
- [x] EAS submission `741333df-a058-49c2-a62e-22d6ca421fad` finished
  successfully. App Store Connect build
  `ae94d1c5-a98d-4fcd-a928-4d868faebf38` is `VALID`, unexpired, and reports
  `buildAudienceType=INTERNAL_ONLY`, internal state `IN_BETA_TESTING`, and
  external state `NOT_APPLICABLE`. It was not added to an external group or
  App Store review.
- [x] On 2026-08-10, the owner installed Build 102 on a physical iPhone and
  confirmed the account A sign-out to account B sign-in transition. After a
  cold launch, B's profile, feed, Orange balance, and wallet remained correct
  without a visible flash or reuse of A's account-scoped state.
- [x] On 2026-08-10, repeat the account A to B transition while explicitly
  checking safety lists and export state. Account A showed one muted account;
  account B showed zero blocked, muted, and hidden entries after the switch.
  The owner confirmed both full and social export actions opened normally for
  each account, while screenshots independently showed newly generated full
  export share sheets with distinct timestamps. No A-scoped safety or export
  presentation state appeared under B, and no exported payload was retained.
- [x] On 2026-08-10, force-close Build 102 and open the signed-in account's
  copied profile link from Notes. The owner confirmed EasyGo restored to the
  correct public profile without a blank, wrong-account, or crash state. After
  another account created post activity, the owner cold-launched the signed-in
  account and confirmed the matching in-app notification opened the intended
  PostDetails route only after the authenticated UI was ready.
- [x] On 2026-08-10, publish a clearly labelled Build 102 staging post from
  account B. The owner confirmed B's menu exposed Edit/Delete, editing updated
  the post, account A's menu exposed only non-owner safety actions, and B could
  delete the post after switching back. No previous-account state appeared
  during the create, edit, account-switch, or delete sequence.
- [x] On 2026-08-10, enter unique Build 102 text, attach media, and choose a
  category, then cancel without publishing. The owner confirmed the immediately
  reopened new-post composer contained no prior text, media, or category, and a
  subsequently opened reply composer showed no stale draft or attachment flash.
- [x] On 2026-08-10, verify all four deletion activation latches remain `false`.
  Railway staging web reports `ACCOUNT_DELETION_ENABLED=false` with the provider
  cleanup and recent-auth flags unset; the staging worker reports all three
  flags unset. The focused account-isolation, export, navigation, post-menu,
  and composer regression suite passed 67/67 tests; the final full mobile suite
  passed 155/155, and the backend suite passed 209/209 with two existing
  database integration skips. Mobile staging preflight passed with zero
  failures. Account deletion, recent-auth, public-request, stable-identity,
  and provider cleanup remain outside Build 102; the previously verified
  exports and sign-out stay available.

## Dormant recent Apple reauthentication candidate

Do not run these checks from Build 102 or a primary tester account. The current
recent-auth, public-request, stable-identity, and provider-cleanup compile-time
latches remain `false`, and all three Railway runtime deletion flags remain
off. Because that correctly makes the Settings path unreachable, nonce/subject
proof must first use a separately reviewed, internal-only, non-destructive QA
harness against a disposable staging account. That harness must be incapable
of calling `POST /me/account-deletion` and must not be included in a release
candidate. The additive migration and PostgreSQL integration suite must pass
before the harness is approved.

- [ ] On a disposable physical iPhone, open the approved non-destructive
  diagnostic and verify that native `AppleAuthentication.signInAsync` visibly
  prompts after the Privy-authenticated session is already active. Cancelling
  the Apple sheet must leave the session, account, local deletion marker, and
  server data unchanged.
- [ ] Prove the exact nonce representation returned in the real Apple identity
  JWT: raw server nonce versus transformed nonce. Record only a sanitized
  `raw`, `transformed`, or `mismatch` outcome from a reviewed one-shot staging
  probe; never record the nonce, state, identity token, or JWT claims. Pin the
  verified behavior in tests before any latch review.
- [ ] For both a newly created and a returning Apple staging account, prove that
  the RS256-verified native Apple JWT subject derives to the same immutable
  Apple digest already stored for the local user. Confirm missing/changed
  mappings fail before proof consumption. Record only match/mismatch and
  internal request ID; never silently backfill or add a DID-only fallback.
- [ ] Confirm challenge issuance and verification bind the authenticated DID,
  expected DID, `clientRequestId`, challenge ID, nonce, and state. Switching
  accounts, changing any bound field, presenting a token for the wrong native
  audience, or using an expired challenge must produce fixed PII-free failure
  copy and no deletion request.
- [ ] Verify a successful challenge returns an opaque proof and that parallel
  submission or replay can create at most one deletion tombstone. The proof is
  consumed in the local-purge transaction; force one approved staging rollback
  and confirm an idempotent retry can recover without authorizing another
  account or request.
- [ ] Issue a second request-bound challenge after the first proof is attested
  and confirm bearer-only issuance cannot revoke that proof. Verify the
  approved rate limit bounds challenge creation without logging any binding
  value.
- [ ] Confirm identity tokens, nonce/state, reauth proofs, Apple subjects,
  Privy DIDs, and provider digests are absent from device logs, Railway logs,
  analytics, crash reports, exports, and screenshots. Do not use a network
  capture that persists credential bodies.
- [ ] Confirm status and retry for a pre-existing deletion tombstone still work
  after the challenge expires or the Apple credential is unavailable. This
  recovery path must not issue a new challenge or create a second request.
- [ ] Provision and review a dedicated Sign in with Apple key, Team ID, and Key
  ID plus immediate authorization-code exchange, secure token storage, and
  revocation handling. The dormant reauth flow sends no authorization code and
  cannot satisfy this check by itself.
- [ ] Add equivalent recent-auth coverage for Google-only accounts and Android,
  or prove those account-creation methods are unavailable before deletion is
  activated.
- [ ] Re-run the migration on PostgreSQL staging and pass expiry, parallel
  challenge, one-time consume, rollback, post-write race, and provider-worker
  concurrency tests, plus the approved expired/consumed digest lifecycle, before
  requesting physical destructive QA.
- [x] Automated tests prove hashed A/B keys are disjoint, legacy global values
  are never attributed, A purge drains prior writes, the synchronous deletion
  seal rejects later A writes, and concurrent B values survive. Export creation
  and stale cleanup are serialized as well.
- [x] Automated API-surface tests prove every private, viewer-relative, and
  mutating client endpoint requires the captured Privy owner before `fetch`;
  token-provider rebinding and token-subject mismatch fail closed, while public
  discovery endpoints are explicitly anonymous.
- [ ] On physical iOS and Android devices, switch from A to B at every storage,
  API, chained Orange/Squid, export, purge, and logout await boundary. Confirm B
  never displays A search, safety, course, push-registration, social, profile,
  or reward state and A cleanup cannot change B.
- [ ] Remove the non-destructive diagnostic from the release graph and inspect
  the resulting bundle before building any deletion release candidate.
- [ ] After all checks pass, verify all four compile-time latches are still
  closed and all three Railway deletion flags are still off. Latch activation
  and external TestFlight/App Store distribution require a separate reviewed
  release.

## Pass and failure handling

- [ ] `/auth/sync`, feed, profile, follow, notifications, Orange, and quote paths
  all pass without repeated `401`, `404`, `5xx`, or loading loops.
- [ ] No token, email, Privy ID, wallet address, signature, or login code appears
  in an on-screen error or application log.
- [ ] Record failures with build number, device/OS, UTC time, screen, exact user
  action, and screenshot. Do not include credentials or private wallet data.
- [ ] If build 97 shows `STARTUP-STAGE-03`, `STARTUP-PRIVY-05`, or
  `STARTUP-JS-01`, capture the full visible message and a screenshot. If it
  terminates, reopen once and capture `마지막 기록`; also export the newest
  EasyGo analytics `.ips` file from the iPhone when available.
- [ ] After the checklist passes, mark the matching items in
  `backend/docs/DEPLOY_CHECKLIST.md`; keep all Path C feature flags off until
  the privacy and security gates are separately approved.
