# MIGRATION_NOTES.md

## Context

Coineasy was originally built on Orbis (a SaaS layer over Ceramic). Orbis
was discontinued, so the existing screens that depend on `orbis.<x>(...)`
no longer have a working backend. Rather than scrap the social UI we have,
we are repointing it at our own backend (the EasyGo backend introduced in
PR #5 — Express + Prisma + Postgres) and bringing the app fully under the
EasyGo umbrella: cross-chain swap + 🍊 Orange + the existing social loop.

## Phase 1 chain

Per `EASYGO_BUILD_PLAN.md` Path C, Phase 1 ships on **Base mainnet (chainId
8453)**. EasyChain is Phase 2 and gated by `PHASE.EASYCHAIN_ENABLED`.

## Migration steps

### PR #7 — this PR — Orbis isolation + Privy bootstrap

- [x] Add `utils/orbisCompat.js` — noop shim with the same surface as the
      old Orbis SDK so existing `orbis.<x>(...)` callsites do not crash.
- [x] Add stub hooks (`usePosts`, `useReplies`, `useSocialProfile`,
      `useFollow`, `useFeed`) that return empty data and noop mutators.
      These get backend wiring in PR #8.
- [x] In `App.js`: replace `new Orbis({...})` with `createOrbisCompat()`,
      remove hardcoded Pinata API keys (already revoked upstream), wrap the
      JSX with `<PrivyProvider>` (Base supportedChains, app id from env).
- [x] Add `AuthBridge` child component that calls `useAuthSync(privy)` and
      maps the resulting backend profile into `GlobalContext.user` in the
      Orbis-compatible shape so existing screens keep reading
      `user.profile.data` etc. unchanged.
- [x] In `screens/Login.js`: replace the Orbis-based ConnectModal flow with
      a single Privy `login()` call. Privy auto-detects new vs returning.

After PR #7, the app builds and boots; the social screens render without
data (empty lists) but do not crash. Auth via Privy works end-to-end.

### PR #8 — Backend social models + REST API

- [x] Extend `backend/prisma/schema.prisma` with social profile fields plus
      `Post`, `Follow`, and `Like` models. Replies use `Post.parentPostId`.
      Wire the Prisma migration.
- [x] Add REST routes under `/posts`, `/profiles`, and `/follows`. Mutations
      require Privy JWT verification; public reads accept optional auth.
- [x] Add deterministic, repeatable EasyGo demo seed data for local dev, with
      a non-local database safety guard.

### PR #9..N — Wire screens off the orbisCompat shim

One screen group per PR, smallest first:

- [x] `screens/Home.js` + `components/Feed.js` → `usePosts` + `useFeed`
- [x] `components/Postbox.js` → `usePosts.create` + `useReplies.create`
- [x] `screens/Profile.js` + `components/ProfileDetails.js` → `useSocialProfile`
- [x] `components/User.js` (follow button) → `useFollow`
- [x] `screens/Categories.js`, `screens/Search.js`, `screens/News.js` → `useFeed`
- [x] Notifications, modals (PostSettingsModal, RepostModal, etc.)

Each PR removes one or more `orbis.<x>(...)` callsites until the shim has
no consumers.

The profile migration also wires the root-post timeline, profile editing,
follow status/mutations, follower/following/mutual lists, and mutual-follower
counts to the EasyGo REST API. Authored-reply and repost timelines, social-link
persistence, and media upload remain explicit unavailable states until their
backend surfaces are added.

Discovery now uses backend-filtered pagination rather than filtering a single
client page: `GET /posts?q=&tag=` powers post search and hashtag categories,
while `GET /profiles/search?q=` powers username/display-name discovery. The
News screen combines EasyGo `#NEWS` posts with the existing curated RSS feed.
Publishing from a selected category appends that category hashtag when it is
not already present, so new posts immediately belong to the selected feed.

The activity inbox is derived from the existing `Follow`, `Like`, and reply
rows through `GET /notifications`, so it needs no additional database model.
Likes, post editing/deletion, notification-to-thread navigation, Privy account
settings, profile naming, and the first-reward ledger claim now use EasyGo
APIs. All `components/modals` Orbis callsites are removed. Repost/quote,
message media, profile-photo upload, and server-side Expo push-token
registration remain honest unavailable states until those backend models ship.

### PR final — Drop the shim

- [x] Verify zero `orbis.` callsites remain in application/backend source.
- [x] Delete `utils/orbisCompat.js`.
- [x] Remove `orbis` from `GlobalContext.Provider` value.
- [x] Remove the legacy SDK, WalletConnect bridge, and Ceramic packages from
      `package.json` (and `resolutions`). Clean `babel.config.js` /
      `metro.config.js` polyfills that were Orbis-only.

The final migration also moves check-in, daily activity, ad-slot, and quiz
rewards to idempotent backend ledger claims. Course progress remains local to
the device for Phase 1. Legacy chat is shown as unavailable, and the preview
shop never deducts Orange until inventory and fulfillment are server-backed.

### Path C v2 S8 — staged social retirement readiness

The current `/posts`, `/profiles`, `/follows`, and `/notifications` endpoints
are no longer Orbis shims; they are the live EasyGo social backend. S8 therefore
does not immediately remove them. `LEGACY_SOCIAL_MODE` ships as `active`, with
reviewed `read_only` and `retired` transitions available later. Both retirement
modes return a self-service `/me/social-export` path, and `/social/status`
allows a client release to discover capability changes before using a social
screen. No social rows or tables are deleted by S8.

### Path C v2 S2/S9 — staging migration and process readiness

- [x] Generate and commit the additive Path C migration containing SIWE/ENS
      User fields plus consent, quest, segment, advertiser, and campaign tables.
- [x] Add a test that rejects destructive SQL and verifies all eight S2 tables.
- [x] Split web/worker deployment contracts and add `/health` plus `/ready`.
- [x] Add a secret-safe staging preflight and read-only post-deploy smoke runner.
- [x] Create and link the dedicated `easygo-app-staging` Railway project and
      its isolated `staging` environment.
- [x] Configure the required backend secrets and pass the secret-safe deploy
      preflight with zero failures.
- [x] Inspect staging migration status, apply `prisma migrate deploy` once from
      a controlled release step, and verify both migrations are up to date.
- [x] Create an Apple Distribution certificate and App Store provisioning
      profile for `com.coineasy.coineasysocial`, then store both in EAS.
- [x] Complete the first iOS TestFlight staging build. Build `85` (EAS build
      `4e1791dd-2905-4eb0-acd9-0d622155dcf5`) compiled successfully but Apple
      rejected its upload with `90725` because its Xcode 16.2 image used the
      iOS 18.2 SDK. The first Xcode 26 builds then exposed Expo SDK 51's legacy
      `expo-device` and `expo-dev-menu` simulator macros, so installs now apply
      narrow compatibility patches for both. The app also uses Expo's standard
      `expo/AppEntry.js` entry point to avoid the SDK 51 Metro SHA-1 entry-file
      bug. Build `86` (EAS build `8d659012-a326-4cd9-9777-8053e0c1e504`)
      then completed on Xcode 26.0 and submission
      `091677ee-82c6-413f-9c09-af34092c3c12` finished successfully. Apple App
      Store Connect reports build `2.0.0 (86)` as `VALID` and not expired.
      It is assigned to the six-tester internal group with access to all builds.
- [x] Complete an Android internal preview APK. The first build failed because
      the image's Node 20.19.2 did not satisfy the locked Expo Doctor engine;
      the preview EAS profile now pins Node 20.19.4. Replacement build
      `d3e60d71-484d-4c1e-bbde-bc7074c90bbb` completed successfully.
- [x] Fix the startup crash found during physical-device installation. The
      Privy `AuthBridge` consumed `GlobalContext` after rendering outside its
      provider, so its first authenticated state sync called missing setter
      functions. It now renders inside the provider, and mobile preflight has
      a regression check for this scope contract. Android versionCode 64 and
      iOS build 87 are the replacements. Android EAS build
      `868e27b8-65e2-4b25-81cb-ecd0a955d55f` completed with a verified APK;
      iOS EAS build `ed444075-8f44-44b8-aec6-856c58212d05` was accepted as
      `VALID` by App Store Connect and is available to the internal group.
- [x] Contain the remaining iOS startup failure reproduced on an iPhone 16 Pro
      Max with build 87. Authenticated-only modals now mount only after login,
      startup render failures fall back to the `STARTUP-JS-01` diagnostic
      screen, splash promises are guarded, and the unconfigured passkey module
      is no longer imported on the login path. EAS build
      `940e49e1-4c36-4151-90a6-2766e1dad9fa` and submission
      `39c0b031-98e0-44e6-8dd5-7ada02bdd6fa` completed successfully. App Store
      Connect build `2.0.0 (88)` (`ed5e95a3-f023-4ba6-88c4-c90c805be4a4`) is
      `VALID`, unexpired, and available to the internal TestFlight group.
- [x] Fix the pre-render startup failure that remained on build 88. The app
      imported `Login` and therefore `@privy-io/expo` before Privy's required
      text-encoding, random-value, and ethers polyfills evaluated, so a module
      initialization error could terminate release builds before the React
      error boundary mounted. A dedicated `entrypoint.js` now loads all three
      polyfills before the application graph, and preflight enforces that
      order. EAS build `e4f1a034-ff51-412d-a239-d49a18e3ac10` and submission
      `990b8f6f-6632-4c9b-9029-0fe15a6c782a` completed successfully. App Store
      Connect build `2.0.0 (89)` (`9e65abfa-dbdf-4a15-9b70-94fe0a0f82f3`) is
      `VALID`, unexpired, and available to the internal TestFlight group.
- [x] Ship a controlled diagnostic after build 89 still terminated on the
      iPhone 16 Pro Max. Build 90 initially registers a minimal React Native
      screen without importing the application graph. `EasyGo 시작` then loads
      the required polyfills and the app in explicit stages, rendering
      `STARTUP-MODULE-02` for module-load failures while retaining
      `STARTUP-JS-01` for render failures. This separates a native/Expo startup
      crash from the application/Privy module path before the next structural
      change. EAS build `fe4ab796-b7cd-4323-9bbc-96e2af4bc0bc` and submission
      `bc3bd439-6eb0-403f-b9f9-c2d57b78dcd1` completed successfully. App Store
      Connect build `2.0.0 (90)` (`29e08ff6-68dd-4403-a39e-ba3f8e4321ff`) is
      `VALID`, unexpired, and available to the internal TestFlight group.
- [x] Correct the release-environment diagnosis exposed by build 92. The
      protected `STARTUP-CONFIG-01` screen proved the app graph rendered, while
      the release bundle lacked `EXPO_PUBLIC_PRIVY_APP_ID` and
      `EXPO_PUBLIC_PRIVY_CLIENT_ID`. Metro now uses `babel-preset-expo`; the
      downloaded build 93 IPA contains both public IDs and the staging backend
      URL. EAS build `281c72d3-e232-4202-8e11-92a58498c2d3` and submission
      `7ed1bbba-35f1-4200-9df8-b5b90f7d0d55` completed successfully. App Store
      Connect reports build `2.0.0 (93)`
      (`e285c8cd-5df9-4e3c-a3d5-593076921db8`) as `VALID`.
- [x] Complete build 94 after build 93 continued to terminate in the configured
      Privy path. Build 94 records every risky startup phase in AsyncStorage, verifies
      SecureStore and the Privy client before Provider mount, reports
      `usePrivy().error`, disables automatic wallet migration, and keeps one
      Privy client/Provider alive while switching from the probe to EasyGo.
      Privy authentication stays in SecureStore under the versioned
      `easygo-privy-v2-` namespace; wallet recovery storage is not deleted. EAS
      build `97a86043-1a61-4857-a39d-c6482481a013` completed from commit
      `38106ce`; the downloaded IPA passed build-number, identifier, scheme,
      release-value, and diagnostic-marker inspection.
- [x] EAS submission `ce442d06-f1f0-4371-9506-226472516582` finished without
      an error. App Store Connect marks build `2.0.0 (94)`
      (`f7d1a1ed-24b0-473c-82ac-2aaec98328c3`) as `VALID`. Apple currently
      reports no matching beta crash-feedback submission or diagnostic
      signature for build 94.
- [x] Build 95 isolates the remaining native termination boundary behind five
      user-gated steps: the real Privy SecureStore adapter, client construction,
      `client.initialize()`, the SDK-equivalent standalone WebView, and
      `PrivyProvider`. Every pending/passed/failed transition is persisted under
      the v95 startup key, WebView retries use attempt guards, and a missing
      load event fails visibly after 15 seconds. EAS build
      `8c0a204c-36c8-4f27-8f01-6e9c5966de2b` completed from commit `a4fd7be`;
      the downloaded IPA passed archive, identity, version, URL-scheme,
      release-value, and diagnostic-marker inspection.
- [x] EAS submission `f9106ab4-5459-4ec9-86de-8aa0caf7bebf` finished without
      an error. App Store Connect marks build `2.0.0 (95)`
      (`586e5396-157a-43a6-a5c5-41e930e3ba1b`) as `VALID`; Apple currently
      reports zero matching beta crash-feedback submissions and no diagnostic
      signature.
- [x] Physical-device build 95 testing shows that the process exits after the
      third user-gated action, `client.initialize()`, on the affected iPhone 16
      Pro Max. The exact EasyGo SecureStore adapter and client construction are
      the last passed steps; neither the standalone WebView nor `PrivyProvider`
      is mounted.
      A repeat App Store Connect query still returned no matching crash feedback
      or diagnostic signature. The public Privy app-config endpoint returns
      HTTP 200 and allows `com.coineasy.coineasysocial`, ruling out missing
      release identifiers and the mobile-client allowlist.
- [x] Build 96 moves the iOS JavaScript engine from Hermes to JavaScriptCore
      while keeping Android on Hermes and retaining the same five-stage Privy
      isolation. It also removes the unused Babel `buffer` alias and
      `@craftzdog/react-native-buffer` dependency: the resolved native buffer
      package pulled `react-native-quick-base64@3`, which requires the New
      Architecture and is not valid for this Expo SDK 51 old-architecture app.
      A clean iOS export dropped from 2,681 to 2,679 modules and contains no
      `QuickBase64` code. The app version moves to `2.0.1`, build number to
      `96`, and startup key to `easygo.startup-probe.v96`; the app-version
      runtime policy separates this binary from the existing `2.0.0` Hermes
      updates. Preview updates must still be audited so no Hermes bundle is
      later published for runtime `2.0.1`. The diagnostic screen also reports
      the actual engine and OS.
- [x] Treat Build 96 as a compatibility build rather than a single-variable
      A/B. It removes both known release risks: the release-only A18 Pro/iOS 26
      Hermes pattern tracked in
      [Expo issue 44680](https://github.com/expo/expo/issues/44680), and the
      unsupported QuickBase64 v3 path documented by
      [react-native-quick-base64](https://github.com/craftzdog/react-native-quick-base64#installation).
      A successful device run will prove the combined fix, but not which risk
      caused Build 95 without an Apple `.ips` stack.
- [x] Complete EAS iOS build `d0a50681-01cf-4909-a5fc-d25f7026ba22`
      (`2.0.1 (96)`) from exact commit `5cf7a82`. The downloaded
      27,023,318-byte IPA has SHA-256
      `b492a3ca671118ed64f95e3df318d926a1ed3081741c2455e1681f6a66361ea9`.
      Its executable links JavaScriptCore, its plain-JavaScript bundle exactly
      matches the local export hash, and neither Hermes nor QuickBase64 is
      present. Bundle identity, scheme, runtime `2.0.1`, all three public
      release values, and v96 markers pass inspection.
- [x] EAS submission `4b2e3597-0466-46b7-bb02-ff77c292c605` finished without
      an error. App Store Connect marks build 96
      (`0af9db65-98b4-4200-adf1-a68b516adb1d`) as `VALID`.
- [x] Run build 96 on the affected iPhone 16 Pro Max. The screen confirms JSC
      on iOS 26.5; SecureStore, client construction, and `client.initialize()`
      pass and the process remains alive. Stage 4 reaches the standalone
      WebView `onLoad`, but the diagnostic-only immediate `ping(5000)` returns
      false at `2026-08-01T19:37:23.229Z`.
- [x] Trace the stage-4 result against the installed Privy Expo 0.59.6 and core
      0.56.1 sources. The official WebView treats native `onLoad` as loaded and
      only pings when the app returns to the foreground. The build 96 gate was
      therefore stricter than the SDK and could race the page's message-listener
      setup; it does not show a WebView load failure or a new app crash.
- [x] Prepare build 97 as `2.0.2` on the existing JSC engine with a new
      app-version runtime boundary and v97 diagnostic keys. Stage 4 now follows
      the SDK load contract without a blocking initial ping; step 5's official
      `PrivyProvider` and `usePrivy().isReady` remain the readiness authority.
- [x] Complete EAS iOS build `53e28492-108b-455d-bd3f-ca38b6f3909c`
      (`2.0.2 (97)`) from exact commit `216763a`. The downloaded 27,023,271-byte
      IPA has SHA-256
      `8edfa5829ee78a22e853ce9181fdcbc528e1e08c066822c93dbf9e5055fd9447`.
      Its executable links JavaScriptCore, and neither Hermes nor QuickBase64
      is present. The plain-JavaScript bundle exactly matches the clean local
      export at SHA-256
      `c6f5b0dfe152ff6812ee3de81cf2eb7b713622cd5c4ad917ad49830f2c23ba72`;
      identity, scheme, runtime `2.0.2`, public release values, v97 markers,
      and removal of the obsolete readiness error pass inspection.
- [x] EAS submission `d5f0bebc-7156-41ef-a2c6-cfe463146d7a` finished without
      an error. App Store Connect marks build 97
      (`51d84fef-c246-4f72-b4a7-b74b718dacd6`) as `VALID`; matching crash
      feedback is currently zero.
- [x] Install build 97 on the affected iPhone 16 Pro Max and run all five
      user-gated steps before opening the full EasyGo app. On JSC and iOS 26.5,
      the standalone WebView passes at `2026-08-01T20:26:58.793Z`, official
      Provider/session readiness passes at `2026-08-01T20:27:07.378Z`, and the
      branded login screen remains open. This closes the startup-termination
      investigation; real OAuth, session restoration, and core API QA remain
      separate release gates.
- [x] Harden the real OAuth handoff and session lifecycle in commit `489469b`.
      User-cancelled OAuth is silent, genuine failures use fixed PII-free copy,
      relogin reconnects the token provider, and each authenticated transition
      performs one race-safe `/auth/sync`. The matching Railway staging deploy
      passes `/ready`, `/health`, and `/social/status`.
- [x] Enable Apple and Google on the EasyGo Privy mobile client and configure
      the Sign in with Apple key for primary App ID
      `com.coineasy.coineasysocial`. The public Privy config reports both OAuth
      providers enabled. Commit `7630bd5` adds Expo-native
      `embedded.ethereum.createOnLogin: all-users` to both Provider paths, so
      headless OAuth creates one Base EVM wallet before `/auth/sync`.
- [x] Complete EAS iOS build `0d066e38-0ebf-464d-a20a-ae365f033f49`
      (`2.0.2 (98)`) from exact commit
      `8af34fec27a41037b7d740d7160314db6c45ce26`. EAS submission
      `ead73b34-a9c2-4daf-a713-9664334f0178` finished without an error, and App
      Store Connect marks build `2a5786df-fd8c-46aa-9a05-0fdbed9240e7`
      `VALID` with zero matching beta crash feedback.
- [x] Inspect the 27,024,088-byte Build 98 IPA at SHA-256
      `497b0c238f66b90f8bf2a1b7d96b17f52597484bb66e55669bebb6728647b9c9`.
      Its JSC bundle exactly matches the clean local export at SHA-256
      `5f74b78a4dbdd26e31ddc78a6918571906ccf65469d2d4773abc22a139ede699`;
      release identifiers, staging URL, and Base wallet creation setting are
      present while the Apple private signing-key body and key ID are absent.
- [x] Complete a real-device Apple OAuth round trip in Build 98 on the affected
      iPhone 16 Pro Max. Sign up with Apple returns through `coineasyapp`, keeps
      the mobile process alive, and renders the signed-in profile. The follow-up
      staging trace isolated the remaining `0` balance to a failed backend
      `/auth/sync`, not to the Apple OAuth or mobile Privy Provider path.
- [x] Diagnose that post-login sync failure without exposing credentials. The
      Build 98 request reached staging at `2026-08-02T06:55:46Z`, Privy's server
      user lookup rejected the configured credential with `401`, no new local
      user row was written, and the uncaught Express 4 async rejection restarted
      the web process. Railway contained Privy's masked display placeholder,
      not a usable App Secret.
- [x] Prepare Build 99's recovery path. `/auth/sync` now converts Privy lookup
      failures into safe `502`/`503` responses, preserves the additive `isNew`
      contract, repairs a missing one-time welcome ledger row on retry, and
      returns the final Orange balance. The mobile bridge performs finite
      transition-scoped retries, blocks stale-account results, and hydrates the
      header balance immediately. Mobile tests pass 28/28; backend tests pass
      119 with the existing SIWE test skipped; the iOS export succeeds.
- [x] Create one new EasyGo Privy App Secret with owner approval and replace
      only the masked Railway web-service value without exposing it. The
      variables-only deployment
      `f0ed7ad2-fac3-49dd-b102-8417d62fc948` is `SUCCESS`/`RUNNING`; all three
      health surfaces return HTTP 200. A remote Privy server query succeeds,
      finds the Apple user, and reports exactly one embedded EVM wallet.
- [x] Build, inspect, and submit iOS `2.0.2 (99)`. EAS build
      `3a8dee19-9989-43b6-a8c4-7ecf84717cc4` uses exact commit
      `6a2277018edf21abe1bb3defa4a53175d2971703`; its JSC bundle exactly matches
      the clean local export. Submission
      `3a7193a1-3eda-42ef-9717-46cc225aa243` finished without an error, and App
      Store Connect marks build `3f5a6f66-f845-42bd-a2a8-75ce0557be97`
      `VALID`, unexpired, with zero matching beta crash feedback.
- [x] Verify the Railway web shutdown contract in a real replacement deploy.
      Production commands now launch Node directly, and the replaced web
      process logged `SIGTERM`, `stopping`, `stopped`, and exit code zero before
      the replacement passed `/health`, `/ready`, and `/social/status` smoke.
- [x] Take and verify a recoverable staging DB backup before production
      approval. Railway's native backup/PITR UI is Pro-only, so the Hobby
      staging database was exported in PostgreSQL custom format and encrypted
      locally without persisting plaintext. Backup
      `easygo-staging-20260722T090134Z.dump.enc` has SHA-256
      `5817cfafb9a661934de0107362cf59afd25647ee1ba5eb4bc2085708acc78a55`;
      its AES-256 passphrase is stored in macOS Keychain service
      `easygo-staging-postgres-backup-20260722T090134Z`. An in-memory decrypt
      verified the `PGDMP` header and exact 41,032-byte round trip.
- [x] Verify the Apple staging user's post-secret device sync. The single
      `/auth/sync` request returned HTTP 200; one EasyGo user now matches the
      Privy identity, its stored address matches the user's only embedded EVM
      wallet, and exactly one user-bound `WELCOME_BONUS` row yields a `100`
      Orange balance. No credential, identity, email, or address was recorded.
- [x] Add a fail-closed embedded-wallet runtime probe for `eth_chainId` and
      `eth_accounts`. The own-profile address remains copy-only, while a
      separate Base status badge opens BaseScan only after chain `0x2105` and
      account equality both pass. Public profile projections no longer disclose
      `walletAddress`; authenticated own-profile responses retain it.
- [x] Build, inspect, submit, and process iOS `2.0.3 (100)` from exact commit
      `cb6ac70d922d170fd840f9d2b63e75b4d92a1516`. EAS build
      `c545d16a-7237-456c-8efe-53641e2a7286` and submission
      `370b5cb0-cf9f-4b7c-b572-4e03cc3018a9` finished successfully; App Store
      Connect reports build `c4dbfafd-b4ae-4bd5-8e9d-749a5a5ae0a7` as `VALID`.
- [x] Verify Build 100 cold-launch session restoration, the visible
      `Base · Connected` result, copy-only address control, BaseScan routing,
      and public-profile wallet privacy on the affected iPhone 16 Pro Max.
- [ ] Verify Google OAuth, logout/relogin wallet stability, and the remaining
      core API paths against staging.
- [x] Add the Build 101 mobile privacy-center candidate: authenticated
      account-bound consent reads, version-bound fail-closed drafting,
      full/social JSON export, temporary iOS file cleanup, Android SAF saving,
      and a visible deletion safety gate. Static tests and iOS export pass;
      runtime file/share behavior remains device-QA pending. Consent grants
      remain independently default-off until matched EasyGo legal documents are
      published; revocation remains allowed.

## Owner action items (outside this PR)

- [x] Revoke + rotate the previously-hardcoded Pinata API keys.
- [x] Set `EXPO_PUBLIC_PRIVY_APP_ID` and `EXPO_PUBLIC_PRIVY_CLIENT_ID` in the
      local `.env` for the EasyGo mobile client.
- [x] Set the same public identifiers plus `EXPO_PUBLIC_BACKEND_URL` in the EAS
      `development` and `preview` environments for `@coineasy/easygo`.
- [x] Add the staging `EXPO_PUBLIC_BACKEND_URL` to the local root `.env`.
- [x] Confirm `/auth/sync` is guarded by `requireAuth`, which verifies the
      Privy Bearer access token before profile sync.
- [ ] Replace the centralized legacy ThePivot terms/privacy fallbacks
      with EasyGo-branded documents that share an explicit effective version,
      then set the backend and mobile consent versions to that exact published
      version. Enable `CONSENT_GRANTS_ENABLED` only after that review.

## Privy + AuthBridge data flow (Phase 1)

```
+------------------+   login()     +--------------+   POST /auth/sync
|  Login screen    |  ---------->  |   Privy SDK  |  ---------------->  Backend
+------------------+               +--------------+                       |
                                                                          v
                         +-----------------+        profile JSON
                         |  AuthBridge     |  <----------------------------
                         |  (in App.js)    |
                         +--------+--------+
                                  | setUser / setUserData (presentation state)
                                  v
                         +-----------------+
                         |  GlobalContext  |  ←  consumed by every screen
                         +-----------------+
```

## Why a shim was used during migration

The legacy Coineasy code had hundreds of `orbis.<x>(...)` callsites across
screens, components, and modals. Deleting them all in a single PR would be
unreviewable and high-risk. The shim lets us:

1. Ship a working build immediately (no broken imports, no crash on
   GlobalContext access).
2. Migrate one feature at a time, with a clear PR boundary per area.
3. Track progress: `grep "orbis\." | wc -l` is a real burndown counter.
4. Delete the shim cleanly once the counter hits zero (now complete).

## Out of scope (deferred to later phases)

- EasyChain bridging UX (Phase 2 — gated by `PHASE.EASYCHAIN_ENABLED`).
- Avatar NFT flow (`PHASE.AVATAR_NFT_ENABLED`).
- 🍊 Orange tokenization (`PHASE.ORANGE_TOKENIZED`). Phase 1 keeps Orange
  as a backend-DB hype point ledger.
- NEAR Intents settlement (`PHASE.NEAR_INTENTS_ENABLED`).
