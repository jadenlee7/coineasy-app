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
- [x] Take and verify a recoverable staging DB backup before production
      approval. Railway's native backup/PITR UI is Pro-only, so the Hobby
      staging database was exported in PostgreSQL custom format and encrypted
      locally without persisting plaintext. Backup
      `easygo-staging-20260722T090134Z.dump.enc` has SHA-256
      `5817cfafb9a661934de0107362cf59afd25647ee1ba5eb4bc2085708acc78a55`;
      its AES-256 passphrase is stored in macOS Keychain service
      `easygo-staging-postgres-backup-20260722T090134Z`. An in-memory decrypt
      verified the `PGDMP` header and exact 41,032-byte round trip.
- [ ] Run real-device Privy login and core API QA against the staging URL.

## Owner action items (outside this PR)

- [x] Revoke + rotate the previously-hardcoded Pinata API keys.
- [x] Set `EXPO_PUBLIC_PRIVY_APP_ID` and `EXPO_PUBLIC_PRIVY_CLIENT_ID` in the
      local `.env` for the EasyGo mobile client.
- [x] Set the same public identifiers plus `EXPO_PUBLIC_BACKEND_URL` in the EAS
      `development` and `preview` environments for `@coineasy/easygo`.
- [x] Add the staging `EXPO_PUBLIC_BACKEND_URL` to the local root `.env`.
- [x] Confirm `/auth/sync` is guarded by `requireAuth`, which verifies the
      Privy Bearer access token before profile sync.
- [ ] Replace the legacy ThePivot terms/privacy PDFs linked from `Login.js`
      with EasyGo-branded documents that share an explicit effective version,
      then set `EASYGO_CONSENT_VERSION` to that exact published version.

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
