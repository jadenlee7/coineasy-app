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

- [ ] Extend `backend/prisma/schema.prisma` with `Post`, `Reply`, `Profile`,
      `Follow`, `Like` models. Wire Prisma migrations.
- [ ] Add REST routes: `/api/posts`, `/api/replies`, `/api/profiles`,
      `/api/follows`, `/api/likes`. All gated by Privy JWT verification.
- [ ] Backfill seed data for local dev.

### PR #9..N — Wire screens off the orbisCompat shim

One screen group per PR, smallest first:

- [ ] `screens/Home.js` + `components/Feed.js` → `usePosts` + `useFeed`
- [ ] `components/Postbox.js` → `usePosts.create` + `useReplies.create`
- [ ] `screens/Profile.js` + `components/ProfileDetails.js` → `useSocialProfile`
- [ ] `components/User.js` (follow button) → `useFollow`
- [ ] `screens/Categories.js`, `screens/Search.js`, `screens/News.js` → `useFeed`
- [ ] Notifications, modals (PostSettingsModal, RepostModal, etc.)

Each PR removes one or more `orbis.<x>(...)` callsites until the shim has
no consumers.

### PR final — Drop the shim

- [ ] Verify zero `orbis.` callsites remain (grep).
- [ ] Delete `utils/orbisCompat.js`.
- [ ] Remove `orbis` from `GlobalContext.Provider` value.
- [ ] Remove `@orbisclub/orbis-sdk` and Ceramic packages from
      `package.json` (and `resolutions`). Clean `babel.config.js` /
      `metro.config.js` polyfills that were Orbis-only.

## Owner action items (outside this PR)

- [x] Revoke + rotate the previously-hardcoded Pinata API keys.
- [ ] Set `EXPO_PUBLIC_PRIVY_APP_ID` in `.env` (local) and in EAS env
      (build). The current EasyGo Privy app ID is known.
- [ ] Confirm the backend `/auth/sync` endpoint validates Privy JWTs
      (this should already be true from PR #5 — verify before PR #8).

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
                                  | setUser / setUserData (Orbis-shape)
                                  v
                         +-----------------+
                         |  GlobalContext  |  ←  consumed by every screen
                         +-----------------+
```

## Why a shim instead of deleting Orbis calls now

The legacy Coineasy code has hundreds of `orbis.<x>(...)` callsites across
screens, components, and modals. Deleting them all in a single PR would be
unreviewable and high-risk. The shim lets us:

1. Ship a working build immediately (no broken imports, no crash on
   GlobalContext access).
2. Migrate one feature at a time, with a clear PR boundary per area.
3. Track progress: `grep "orbis\." | wc -l` is a real burndown counter.
4. Delete the shim cleanly once the counter hits zero.

## Out of scope (deferred to later phases)

- EasyChain bridging UX (Phase 2 — gated by `PHASE.EASYCHAIN_ENABLED`).
- Avatar NFT flow (`PHASE.AVATAR_NFT_ENABLED`).
- 🍊 Orange tokenization (`PHASE.ORANGE_TOKENIZED`). Phase 1 keeps Orange
  as a backend-DB hype point ledger.
- NEAR Intents settlement (`PHASE.NEAR_INTENTS_ENABLED`).
