# EasyGo staging device QA

Use this checklist for the internal-only wallet-runtime TestFlight candidate
`2.0.3 (106)`, its social-author/edit predecessor `2.0.3 (104)`, the
legal-consent predecessor `2.0.3 (103)`, and the existing Android preview build
`versionCode 64`. All clients must target
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
- [x] On 2026-08-11, complete one new Google sign-in on Build 103. Its OAuth
  return through `coineasyapp` succeeded without a raw Privy error. The owner
  then signed out, returned with the same Google account, and finally restored
  the original Apple account without cross-account profile or Orange state.
- [x] Confirm the expected session state. Build 103 preserved the versioned
  `easygo-privy-v2-` SecureStore namespace, survived a full app restart, and
  returned the same Google profile and wallet after logout/relogin.

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
- [x] Complete one configured Privy sign-in. Both Apple and Google returned to
  EasyGo through the `coineasyapp` scheme, and the Google session survived an
  app restart on Build 103.
- [x] For a new Apple or Google user, confirm exactly one embedded EVM wallet
  is created, the backend profile stores the same address, and the wallet
  provider reports Base chain ID `0x2105`. On Build 100 or newer, the own
  profile must show `Base · Connected`; tapping the address still copies it,
  while tapping the separate Base badge opens that address on BaseScan. Logout
  and relogin must not create a second address. For the new Google user, the
  owner confirmed the same private address before and after relogin without
  disclosing it. Privacy-preserving staging counts moved exactly from four to
  five users, wallets, and `WELCOME_BONUS` rows; no user lacked a wallet and no
  welcome row had a missing reference or non-`100` delta.
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
- [x] Load the home feed, open one post/thread, and refresh once. Build 103
  completed this across the Apple/Google account regression, and Railway
  recorded only successful feed/post and `/auth/sync` responses in the checked
  window.
- [x] Publish one clearly labelled staging text post, edit it, and delete it.
  - 2026-08-10/Build 102: owner created a labelled staging post, edited and
    deleted it successfully; there was no account leakage or stale draft during
    account-switch flow.
- [x] On that post, open the overflow menu and confirm Edit/Delete appear for
  the signed-in author, while another account sees only Report/Block/Hide/Mute.
  - 2026-08-10/Build 102: post-menu checks passed for owner (Edit/Delete) and
    non-owner (Report/Block/Hide/Mute only), then owner deleted the post after
    account-switch flow.
  - 2026-08-11/Build 104: owner confirmed non-owner menu exposure was exactly
    Report, Block, Hide, and Mute with no safety action executed.
- [x] Type text, attach media, and select a category in the composer; cancel it,
  immediately open a new post/reply composer, and confirm no prior draft flashes
  or survives into the new presentation.
  - 2026-08-10/Build 102: owner entered unique text/media/category, cancelled,
    reopened a new composer immediately, and confirmed no stale draft or
    attachment remained in either post/reply composition flows.
- [x] Open another staging profile, follow then unfollow it, and confirm both
  profile counts and state update. On 2026-08-20, the owner completed this on
  Build 109 without an auth or server error.
- [x] Share the own-profile QR/link and open its `coineasyapp://user?userId=…`
  URL both while EasyGo is ready and from a cold launch. It must navigate to
  that public EasyGo profile without exposing or interpreting a Privy DID.
  Build 109 opened the intended profile exactly once in both states.
- [x] Open Notifications and confirm the screen loads without an auth or server
  error. The owner completed this on Build 109 on 2026-08-20.
- [ ] Where a second tester is available, confirm one follow/like/reply
  notification and that tapping a post event opens the matching PostDetails
  route.
- [x] Open the Orange balance/history and confirm both return consistently after
  a refresh. Claim only a staging-safe idempotent reward already exposed by the
  UI; do not spend or transfer real assets. Build 109 returned the expected
  balance and history after refresh without spending or transferring assets.
- [ ] Request one Squid quote and verify amount, source, destination, fee, and
  route render. Stop before signing or broadcasting a transaction. Build 109
  cannot exercise this item. The next internal candidate adds Orange → Swap
  quote preview through the separate sanitized `/swap/quote-preview` path, but
  this remains unchecked until that exact backend/mobile SHA is deployed and
  exercised on device. Confirm the screen contains no Sign, Confirm, Swap, or
  Orange-award action and that the preview clears after 20 seconds, background,
  token/amount change, logout, or account switch.
- [x] Open `coineasyapp://` from Safari or Notes and confirm EasyGo foregrounds.
  The owner completed this on Build 109 on 2026-08-20.
- [x] Sign out, sign in again, and confirm profile/feed/Orange data persist. The
  owner completed the Apple return path on Build 109 without a login loop,
  wallet mismatch, or missing owner state.

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
- [x] On 2026-08-11, repeat a focused Build 102 authentication regression after
      staging moved to merged backend release
      `5372bfcd424d8fb071a5c5022f43d33a61d32f05`. The owner force-closed the app,
      signed out, completed Sign in with Apple, and confirmed profile, `100`
      Orange balance, feed, and Settings navigation without a crash or login
      loop. The matching Railway deployment
      `85a4937a-41db-4f85-97f5-3831474437f3` was `SUCCESS`; unauthenticated
      `/auth/sync` and `/auth/me` probes returned the expected PII-free
      `401 missing_bearer`, and the deployment produced no HTTP 5xx during the
      verification window. This is an authentication regression result, not
      approval of the still-candidate legal documents or dormant deletion flow.

## Build 103 legal-consent candidate

- [x] On 2026-08-11, add the exact candidate version and two versioned EasyGo
      URLs as public EAS `preview` variables only. The staging mobile preflight
      passed with zero failures, the mobile suite passed 156/156, and Expo
      Doctor passed 17/17. A preview-environment iOS export produced a
      6,166,900-byte bundle with SHA-256
      `564a02677c8f1816ccb7a0c00041929ca816d1237cef8a427c6cb69ed52bfd04`;
      it contains the candidate version and both URLs, no Google Drive URL,
      no complete private-key block, and no server-secret variable name.
- [x] EAS build `f2a3aa79-31bb-41e7-b9de-fdf573422c6d` completed from exact
      clean commit `c8732b1c67b3bedade78fe057d7907221bc057f8` with the
      `testflight` profile, `preview` channel, and staging target. The
      27,045,118-byte IPA has SHA-256
      `6be03dfc97634d739471bed4eb2d3cc1f42ef3a886d3bfb78ae083f09fe7544f`
      and reports `2.0.3 (103)`, `com.coineasy.coineasysocial`, and
      `coineasyapp`.
- [x] The inspected release artifact links JavaScriptCore and its 6,166,900-byte
      bundle exactly matches the clean preview-environment export at SHA-256
      `564a02677c8f1816ccb7a0c00041929ca816d1237cef8a427c6cb69ed52bfd04`.
      It contains exact consent version `2026-08-10-staging-v1` and both matching
      versioned EasyGo staging URLs, with no legacy Google Drive URL, complete
      private-key block, or server-secret variable name.
- [x] EAS submission `90463ef8-67ad-40bb-8570-bb91b2d58794` finished
      successfully. App Store Connect build
      `37314fb9-8f11-4dcb-adf3-ea509ff920a7` is `VALID`, unexpired, and reports
      `buildAudienceType=INTERNAL_ONLY`, internal state `IN_BETA_TESTING`, and
      external state `NOT_APPLICABLE`. It was not added to an external group or
      App Store review.
- [x] On 2026-08-11, the owner installed Build 103 from TestFlight, completed
      Sign in with Apple, and opened Settings. The policy card showed server
      version `2026-08-10-staging-v1`, reported that re-consent is required, and
      kept new consent choices review-locked without a crash or login loop.
- [x] On 2026-08-11, the owner opened Privacy policy and Terms of service from
      Settings. Each control opened its matching versioned EasyGo staging
      document rather than a legacy Google Drive document, and returning to
      EasyGo preserved the authenticated account.
- [x] Confirm the client cannot send a new consent grant while the server
      reports `grantsEnabled=false`. The owner observed the review-locked
      Build 103 controls, the deployed service reported the gate as disabled,
      and the complete mobile regression suite passed the matching fail-closed
      client contract on 2026-08-11.
- [ ] If a prior consent exists, verify full revocation remains available
      without enabling personalization or marketing. A privacy-preserving
      staging aggregate found no consent rows on 2026-08-11, so this check was
      not manufactured by creating or altering user data.
- [x] On 2026-08-11, re-check profile, `100` Orange balance, feed,
      full/social JSON export, sign-out, and Apple sign-in after the legal-link
      flow. The owner confirmed that the same profile, balance, feed, and
      review-locked consent version remained after Apple reauthentication and
      that both iOS share sheets opened. Railway recorded successful
      `/auth/sync`, consent, Orange, feed/post, `/me/data`, and
      `/me/social-export` responses. The checked QA window contained no `401`,
      5xx, or application error log.
- [x] On 2026-08-11, verify social post ownership across the Apple and Google
      staging accounts. The Apple account created and edited the test post;
      the Google account's menu exposed only Report, Block, Hide, and Mute,
      with none of those safety actions executed. Returning to Apple completed
      one server-backed deletion. The checked requests returned successful
      create, update, and delete responses without an HTTP error; the deleted
      row retained no author, body, or media data.
- [ ] Re-run the same post flow on the follow-up internal candidate. Build 103
      exposed two presentation defects: an active account with no chosen
      profile name was labelled `Deleted account`, and a category-free edit
      draft did not expose its text input until Category was opened. The local
      fix now reserves `Deleted account` for a missing/deleted author and makes
      category-free or public drafts editable on first render. The 157-test
      mobile suite and iOS export pass, but physical-device verification is
      still required. A privacy-safe staging aggregate remains one active root
      post above the pre-test baseline after the observed duplicate create, so
      remove that test post through the owning account UI during this rerun.
- [x] Keep all deletion latches, consent grants, and optional Path C Railway
      flags off. Build 103 is a legal-document integration candidate only; it
      does not approve the documents or activate deletion or optional data use.
      A value-safe Railway check reconfirmed the web latches as false or unset;
      the legal manifest remained `publishedForConsent=false`.

## Build 104 social-author/edit candidate

- [x] Prepare `2.0.3 (104)` from the merged PR #32 fix without a backend
      migration, dependency change, feature-flag change, or production
      deployment. The candidate reserves `Deleted account` for a missing or
      redacted author and makes category-free/public edit drafts writable on
      first render. The mobile suite passed 157/157, Expo Doctor passed 17/17,
      and the EAS `preview` staging preflight passed with zero failures. The
      6,167,413-byte preview-environment iOS bundle has SHA-256
      `22da87bf932709299eeebcb780d599ef660db47d7af6bd52fb1c534c12b6d64b`
      and contains no complete private-key payload or server-secret variable
      name.
- [x] EAS build `a8bc6dbf-0976-4eed-8c03-b9ab36729e4c` completed from exact
      clean commit `f7feefc619ab71e1f3fb3870e6cae41683492d50` with the
      `testflight` profile, `preview` channel, and staging target. The
      27,045,298-byte IPA has SHA-256
      `0a236c2f383bedaad85d971f4c8f30a1fe551d3d502f9e7185283b6adf2c2d10`,
      passes its ZIP integrity check, and reports `2.0.3 (104)`,
      `com.coineasy.coineasysocial`, and the `coineasyapp` scheme.
- [x] EAS submission `6d9cf786-a3bf-4412-9eac-af6e80639afc` finished
      successfully. App Store Connect build
      `d04e4c42-d141-4d7e-9990-0c4950094d59` is `VALID`, unexpired, and reports
      `buildAudienceType=INTERNAL_ONLY`, internal state `IN_BETA_TESTING`, and
      external state `NOT_APPLICABLE`. It was not added to an external group or
      App Store review.
- [x] On 2026-08-11, the owner installed Build 104 on the physical iPhone,
      cold-launched the Apple account, and confirmed an active account without
      a chosen profile name displays `EasyGo user`; the deleted-post
      presentation remains `Deleted account`.
- [x] The owner opened the Apple-owned staging test post, selected Edit, changed
      and saved its text without opening Category, and reloaded the feed. The
      existing post updated on first render without leaving a duplicate active
      root post.
- [x] The owner switched to Google and confirmed the non-owner menu exposed
      only Report, Block, Hide, and Mute without executing any of those safety
      actions. After switching back to Apple, the owner deleted the remaining
      `Fm` staging test post through the app.
- [x] The final privacy-safe staging aggregate reports `total=10`, `active=6`,
      `deleted=4`, `activeRoots=3`, `activeAuthorless=0`, and
      `deletedResidual=0`. Active roots returned to the pre-test baseline,
      every active post retains an author, and every deleted row retains no
      author, body, or media data.
- [x] The owner confirmed the Build 104 profile, `100` Orange balance, Base
      wallet status, locked consent state, both versioned legal links, and
      full/social JSON export remained operational without a crash or login
      loop. The checked Railway window contained no repeated `401`, HTTP 5xx,
      or application error log.
- [x] Both staging services retained account deletion, provider cleanup,
      recent-auth deletion, consent grants, and segments as false. All source
      deletion readiness latches remain false; external TestFlight distribution
      and App Store review remain off. Build 104 is an internal regression
      candidate only.

## Build 105/106 wallet-runtime hydration candidate

- [x] Complete, inspect, submit, and process internal-only iOS `2.0.3 (105)`
      from exact commit `46b00a4b13814629be2d817a2cfa24e83a0d43d2`.
      EAS build `5d8bd06a-93ea-425c-96b0-94a9d8ae8a75` and submission
      `9c954609-bab3-4955-b623-c0af54f70185` finished without an error. App
      Store Connect build `ab32b983-7d20-48cf-a4f6-6c5609b36d47` is `VALID`,
      unexpired, and in internal beta testing with external state
      `NOT_APPLICABLE`.
- [x] Verify the 27,046,247-byte Build 105 IPA at SHA-256
      `c912fb951e70a2a921c5b979392e9a99588096afa5484f83155f95c336b0c741`.
      It reports the intended version, build number, bundle identifier, and
      exact release commit. The preview channel had no OTA update group, so the
      submitted bundle was the code running on the device.
- [x] On 2026-08-13, reproduce the remaining Apple profile status defect on
      Build 105. Sign in with Apple and backend `/auth/sync` completed normally,
      but the own profile still displayed `Wallet mismatch`; there was no crash
      or OAuth failure.
- [x] Diagnose the mismatch without exposing an address or account identifier.
      A privacy-safe staging check found one Apple login, one Privy embedded
      Ethereum wallet, a valid DB wallet, and exact DB-to-Privy equality. The
      SDK provider returns the authenticated wallet address for `eth_accounts`.
      The remaining false result came from classifying a temporarily missing
      private comparison address during profile hydration as a real mismatch.
- [x] Keep the security boundary while correcting the presentation result.
      Build 106 requires Base chain `0x2105`, a valid authenticated Privy wallet,
      and provider-account equality. When a valid backend comparison address is
      present it must still match; a malformed comparison is an error and a
      genuinely different address remains `Wallet mismatch`. Only an absent
      hydration value is no longer treated as evidence of mismatch.
- [x] Complete, inspect, submit, and process internal-only iOS `2.0.3 (106)`
      from exact commit `4c3c9639946cae85d9b30c8e25376b95edcc0788`.
      EAS build `4ef86dfb-447b-4c45-be89-40814bef0612` and submission
      `b9d3e556-1654-4de2-a31e-7b214d830f54` finished without an error. App
      Store Connect build `32dcb2ff-98e2-4af9-ba7f-bdff0cc7da69` is `VALID`,
      `INTERNAL_ONLY`, `IN_BETA_TESTING`, unexpired, and has external state
      `NOT_APPLICABLE`. It was not added to an external group or App Store
      review.
- [x] Verify the 27,046,265-byte Build 106 IPA at SHA-256
      `8a9fa865f07fa69985a35313ce5fd2c62b6a2cf68ceb76419e16071629c7b584`.
      It reports `2.0.3 (106)`, bundle identifier
      `com.coineasy.coineasysocial`, an arm64 embedded signature, Team ID
      `A9G84S4PWJ`, and sealed resources.
- [x] On 2026-08-13, the owner installed Build 106 on the physical iPhone 16
      Pro Max and confirmed the requested Apple sign-in/profile regression now
      works: the false `Wallet mismatch` is absent and the own profile reports
      the connected Base wallet normally.
- [x] Build 106 mobile tests passed 166/166, the EAS Preview staging preflight
      passed with zero failures, the preview-environment iOS export completed,
      and PR #43 Backend and Mobile CI both passed. No database migration,
      Railway deployment, feature-flag activation, external TestFlight group,
      or App Store review submission is part of this candidate.

## Build 107 staged-startup profile-link candidate

- [x] Merge the profile-link fix and Build 107 release guard through PR #44 and
      PR #45. Both PRs passed Backend and Mobile CI before merge. Internal-only
      iOS `2.0.3 (107)` was built from exact master commit
      `4b4b5f676de2386f005afb31d48426043776a1e8` with EAS build
      `29d03a10-fcab-43b3-ad5b-436c7d0c93a9`.
- [x] Submit Build 107 with EAS submission
      `41012c52-8b0b-4e41-bb09-ddced40b2d69`. App Store Connect build
      `5b29d180-05ff-416e-aadc-f218a4642ed6` is `VALID`, `INTERNAL_ONLY`,
      `IN_BETA_TESTING`, unexpired, and has external state `NOT_APPLICABLE`.
      It was not added to an external TestFlight group or App Store review.
- [x] Verify the 27,046,646-byte Build 107 IPA at SHA-256
      `3cc3f42e4773b07df7fc2a18e6df4e7aa2c15cd4b478732cbd2318226120bba5`.
      The build reports EasyGo `2.0.3 (107)`, bundle identifier
      `com.coineasy.coineasysocial`, and exact release commit `4b4b5f6`.
- [x] On 2026-08-13, the owner installed Build 107 on the physical iPhone 16
      Pro Max, copied a new own-profile link, and opened it while EasyGo was
      already running. EasyGo navigated to the intended profile exactly once.
- [x] On the same device, fully terminate EasyGo, open the copied profile link,
      complete the staged safety-startup pages, and open the full app. The
      pending link survived staged startup and navigated to the intended
      profile exactly once.
- [x] After both profile-link paths, confirm Apple sign-in session presentation,
      the connected Base wallet, Orange state, and Base-chain state remained
      intact. There was no wallet mismatch, duplicate profile navigation,
      crash, or login loop during the requested regression.
- [x] Build 107 mobile tests passed 166/166, staging preflight passed with zero
      failures, the local iOS export completed, and PR #44 and PR #45 Backend
      and Mobile CI passed. No database migration, Railway deployment,
      feature-flag activation, external TestFlight distribution, or App Store
      review submission is part of this candidate.

## Build 108 automatic-startup candidate

- [x] Merge the automatic-startup implementation and Build 108 release guard
      through PR #47 and PR #48. Both PRs passed Backend and Mobile CI before
      merge. Internal-only iOS `2.0.3 (108)` was built from exact master commit
      `db67233af5045d7920a53c53f799061d577c355c` with EAS build
      `f255c7cf-bbdb-48db-b56c-a441047b599b`.
- [x] Complete EAS submission
      `0d8f9673-c164-44d8-b15e-4db26cd2e4b0` without an error. App Store
      Connect build `b917cd9c-4208-4f93-8e44-8a41bba26e1c` is `VALID`,
      `INTERNAL_ONLY`, `IN_BETA_TESTING`, unexpired, and has external state
      `NOT_APPLICABLE`. It was not added to an external TestFlight group or
      App Store review.
- [x] Verify the 27,046,960-byte Build 108 IPA at SHA-256
      `f0b84e971469bcc2d5757b9ad8660068c193b1368f58de1a4ad513c67da9eb41`.
      The archive reports EasyGo `2.0.3 (108)`, bundle identifier
      `com.coineasy.coineasysocial`, URL scheme `coineasyapp`, an arm64
      embedded signature with Team ID `A9G84S4PWJ`, sealed resources, and
      `TFInternalTestingOnly=true`.
- [x] Build 108 mobile tests passed 168/168 and the EAS Preview staging
      preflight passed with zero failures and only the existing Privy native
      allowlist reminder. No database migration, Railway deployment,
      feature-flag activation, external TestFlight distribution, or App Store
      review submission is part of this candidate.
- [x] On 2026-08-20, the owner installed Build 108 from internal TestFlight on
      the physical iPhone 16 Pro Max, fully terminated EasyGo, and launched it
      from the app icon. EasyGo advanced without an extra tap, completed login,
      and opened the app without a crash or startup stall.
- [ ] Build 108 does not yet pass the visual automatic-startup requirement.
      During the otherwise successful launch, the owner saw the five safety
      startup step labels advance quickly before login. A follow-up build must
      keep normal progress behind the branded launch surface and reserve all
      step labels, markers, and diagnostic controls for recovery mode only.
- [ ] Fully terminate and relaunch EasyGo twice, then background and foreground
      it once. Confirm successful launches do not show diagnostic recovery and
      the authenticated session remains stable. If recovery appears, record
      only the build number, safe startup step label, and timestamp.
- [ ] Sign in with Apple if required and confirm own profile, feed, Orange
      state, connected Base wallet, and Base-chain state remain intact. There
      must be no `Wallet mismatch`, login loop, duplicate account, or deleted
      account presentation for the active owner.
- [ ] Open a newly copied own-profile link once while EasyGo is running and
      once after fully terminating it. Each link must navigate to the intended
      profile exactly once without exposing the retired safety-startup pages,
      losing the pending link, or duplicating navigation.
- [ ] Treat any launch crash, persistent recovery screen, Apple login loop,
      wallet mismatch, missing owner state, or broken warm/cold profile link as
      a release blocker. Keep Build 108 internal-only and use Build 107 as the
      known-good comparison while the blocker is diagnosed.

## Build 109 fixed branded-launch candidate

- [x] Merge the fixed branded-launch implementation through PR #50 and the
      Build 109 release guard through PR #51. Both PRs passed Backend and
      Mobile CI before merge. Internal-only iOS `2.0.3 (109)` was built from
      exact master commit `ce0598e38529f6148cc7436bfc2d3f04cf39ed4c` with
      EAS build `9c774761-f21c-4c2c-a250-6bf4fe25c410`, which finished without
      an error.
- [x] Complete EAS submission
      `a77396b4-b957-4286-9aa1-e9da993c94d0` without an error. App Store
      Connect build `fad7fe98-af82-4ef9-b78d-f303e319ec98` is `VALID`,
      `INTERNAL_ONLY`, `IN_BETA_TESTING`, unexpired, and has external state
      `NOT_APPLICABLE`. It was not added to an external TestFlight group or
      App Store review.
- [x] On 2026-08-20, the owner installed Build 109 from internal TestFlight on
      the physical iPhone 16 Pro Max, fully terminated EasyGo, and launched it
      twice from the app icon. Both launches stayed on the fixed branded
      launch surface until the app opened; none of the five retired safety
      startup step labels or diagnostic recovery controls appeared.
- [x] Background and foreground Build 109 once and confirm the authenticated
      session remains stable without a crash, startup stall, or recovery
      screen.
- [x] Complete the Apple session check and confirm the own profile, feed,
      Orange state, connected Base wallet, and Base-chain state remain intact.
      No `Wallet mismatch`, login loop, duplicate account, or deleted-account
      presentation appeared for the active owner.
- [x] Open a newly copied own-profile link once while EasyGo is running and
      once after fully terminating it. Both links navigated to the intended
      profile exactly once without exposing the retired safety-startup pages,
      losing the pending link, or duplicating navigation.
- [x] Clear the Build 109 device release blockers. No launch crash, persistent
      recovery screen, Apple login loop, wallet mismatch, missing owner state,
      or broken warm/cold profile link was reproduced. Build 109 remains
      internal-only pending any separately approved release expansion.

## Dormant recent Apple reauthentication candidate

Do not run these checks from Build 104 or a primary tester account. The current
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
