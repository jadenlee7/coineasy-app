# Frontend Wiring (Phase 1)

EasyGo React Native (Expo) client → EasyGo backend (Express + Prisma).
Phase 1 boundary: client never talks directly to Squid SDK or Telegram bot token; all server-state mutations go through the backend.

See `EASYGO_BUILD_PLAN.md` §11 (data flow), §12 (backend endpoints), §13.2 (Squid integration).

## Endpoint map

| Client | Backend route | Purpose |
| --- | --- | --- |
| `useAuthSync(privy)` | `POST /auth/sync` | Upsert user on Privy login; awards 100 🍊 welcome bonus on first sync. |
| Settings | `DELETE /me/data` | Confirm and permanently delete EasyGo-local account data; Privy identity remains separate. |
| Privacy settings | `GET/PUT /me/consent` | Read effective consent and atomically update the current row plus audit history. |
| Data access | `GET /me/data` | Fetch a no-store, versioned export of the authenticated user's EasyGo-local records. |
| Social data export | `GET /me/social-export` | Download only the signed-in user's public profile fields, posts, likes, and follow graph. |
| Social capability check | `GET /social/status` | Discover whether social reads/writes are active and find the export path before a future sunset. |
| Dormant ENS client | `GET /identity/subname` | Read the local JustaName issuance state. |
| Dormant ENS client | `POST /identity/subname/challenge` → `/identity/issue-subname` | Sign the exact two-minute provider challenge and issue `<handle>.coineasy.eth`. |
| Dormant segment client | `GET /segments` | Read only the signed-in user's active memberships after current segmenting consent. Rule JSON is never returned. |
| Dormant quest client | `GET /quests`, `POST /quests/:id/start` | List available quests and explicitly start transaction/wallet-sharing flows. |
| Course quiz completion | `POST /quests/:id/complete` | Submit the chosen option for server validation and atomically receive the quiz reward. |
| Dormant SIWE client | `POST /auth/siwe/nonce` → `/auth/siwe/verify` | Request the server-created Base SIWE message, sign it, and persist wallet ownership. UI activation remains gated. |
| `useEasyChainProfile(addr)` | `GET /auth/me` | Read profile (handle, avatar, telegram/kakao IDs). Phase 2 swaps to PROFILE_REGISTRY on-chain. |
| `useOrange(addr)` | `GET /orange/balance` | Read the authenticated user's 🍊 balance from the Postgres ledger. |
| `useOrange(addr)` | `GET /orange/history` | Read the authenticated user's 🍊 ledger entries (limit-paginated). |
| Orange reward screen | `GET /orange/rewards/status` | Read server-derived activity counts and claim timers. |
| First reward modal | `POST /orange/claims/first-reward` | Idempotently award the authenticated user's first 50 🍊 reward. |
| Check-in/activity/ad cards | `POST /orange/claims/{daily-checkin,daily-activity,ad-reward}` | Validate and idempotently record recurring rewards. |
| Course quiz compatibility fallback | `POST /orange/claims/course-quiz` | Used only while the S6 route is hidden; returns `410` after `QUESTS_ENABLED=true`. |
| `getSquidQuote(...)` | `POST /swap/quote` | Backend calls Squid SDK; returns `{ estimate, transactionRequest, params }`. |
| `executeSquidRoute(...)` | `POST /swap/log` | After Privy embedded wallet broadcasts the tx, log txHash → backend awards +10 🍊. |
| `useFeed('home')` / `usePosts()` | `GET /posts` | Read the global social feed with cursor pagination. |
| `useFeed('category', { tag })` | `GET /posts?tag=...` | Read a hashtag category with server-side cursor filtering. |
| `useFeed('search', { query })` | `GET /posts?q=...` | Search root-post bodies without breaking pagination. |
| Search people | `GET /profiles/search?q=...` | Discover profiles by username or display-name substring. |
| `usePosts({ authorId })` | `GET /posts/by-author/:userId` | Read a user's root-post timeline. |
| `usePosts.create(...)` | `POST /posts` | Publish a root text post and update mounted feeds. |
| Post editor | `PUT /posts/:id` | Edit the authenticated author's post body/media URL. |
| `useReplies.create(...)` | `POST /posts` | Publish a reply using `parentPostId`. |
| `useSocialProfile(userId)` | `GET /profiles/:userId` | Read public profile details and live post/follow counts. |
| Profile editor | `PUT /profiles/me` | Update the authenticated user's display name and bio. |
| `useFollow(userId)` | `GET/POST/DELETE /follows/:userId[/status]` | Read and update viewer-relative follow state. |
| Profile mutual counts | `GET /profiles/:userId/followers` | Compare follower summaries for the selected and current user. |
| `useNotifications()` | `GET /notifications` | Derive recent follows, likes, and replies for the authenticated user. |
| `notifyTelegram(...)` | _(none — server-driven)_ | Backend reacts to domain events; client noop. |

When the post composer is opened from a selected category, it appends the
category hashtag at publish time if the body does not already contain it.

## Auth flow (Phase 1)

1. App boot wraps tree in `<PrivyProvider>` with `EXPO_PUBLIC_PRIVY_APP_ID`.
2. On `usePrivy()` → `authenticated === true`, `useAuthSync(privy)` runs once:
   - Calls `setApiTokenProvider(() => privy.getAccessToken())` so all subsequent `api.*` calls carry `Authorization: Bearer <Privy access token>`.
   - `POST /auth/sync` with empty body; backend reads `req.user` from the verified token (see `backend/src/middleware/auth.js`).
   - Backend upserts on `privyDid`, captures linked accounts (telegram, kakao, embedded wallet address), returns `{ user, isNew }`, and awards welcome 🍊 on first creation.
3. Subsequent screens use `api.me()` / `useEasyChainProfile` to read identity state.

## Swap flow (Phase 1, Squid via backend)

```
Client                                     Backend                         Squid
  │                                            │                              │
  │ POST /swap/quote {from,to,amount,...}     │                              │
  ├──────────────────────────────────────────▶│                              │
  │                                            │ squid.getRoute(...)          │
  │                                            ├─────────────────────────────▶│
  │                                            │◀─────────────────────────────┤
  │ { estimate, transactionRequest, params }   │                              │
  │◀───────────────────────────────────────────┤                              │
  │                                            │                              │
  │ Privy embedded wallet signs + broadcasts   │                              │
  │ (target/data/value/gasLimit from txReq)    │                              │
  │                                            │                              │
  │ POST /swap/log {txHash, status, params}   │                              │
  ├──────────────────────────────────────────▶│ Prisma: SwapLog + 🍊 +10     │
  │ { ok: true, orangeAwarded: 10 }            │                              │
  │◀───────────────────────────────────────────┤                              │
```

## Environment variables (client)

Already defined in repo-root `.env.example` (PR #4):

- `EXPO_PUBLIC_BACKEND_URL` — required for `utils/api.js` to function.
- `EXPO_PUBLIC_PRIVY_APP_ID` — required for Privy SDK at app boot.
- `EXPO_PUBLIC_PRIVY_CLIENT_ID` — EasyGo mobile client identifier for the app bundle and URL scheme.
- `EXPO_PUBLIC_TG_BOT_USERNAME` / `EXPO_PUBLIC_TG_WEBAPP_URL` — for `getTelegramLoginUrl`.
- `EXPO_PUBLIC_SQUID_INTEGRATOR_ID` / `EXPO_PUBLIC_SQUID_API_URL` — surfaced in client config but actual SDK runs server-side.

Run `npm run preflight` before local builds and `npm run preflight:staging`
before an EAS staging build. Privy's native app allowlist must contain the
actual identifiers from `app.json`: iOS `com.coineasy.coineasysocial`, Android
`com.coineasy.coineasy`, and URL scheme `coineasyapp`. The Android package is
not the same as the iOS bundle identifier; both must be registered for the same
mobile client if that client is used on both platforms.

## Failure modes

- **Backend URL unset**: `utils/api.js` returns `null` and logs a warning. Hooks expose an unconfigured empty state, so the UI stays usable.
- **Consent policy version unset in production**: `/me/consent` returns `503` until the backend's `EASYGO_CONSENT_VERSION` matches the approved published policy version.
- **Backend unreachable**: requests throw and feed screens expose a retry state while retaining any previously loaded rows.
- **Quest flag off**: course completion receives `404` from `/quests` and falls back to the legacy reward route, so the current app remains usable during rollout.
- **Social mode**: `active` preserves current behavior. A future `read_only` mode returns `410` only for writes; `retired` returns `410` for all social routes. Both responses include `/me/social-export`.
- **Privy not yet authenticated**: `setApiTokenProvider` is unset; requests go without `Authorization` header and backend returns 401. Hooks treat 401/404 as "empty state" rather than error.
- **Quote returns `null`**: `getSquidQuote` swallows `ApiError` so the swap UI can show a graceful retry CTA.

## Remaining screen migrations

- Media upload plus repost/quote relationships.
- Server-side Expo push-token registration; the client currently retains the token on-device only.
- Messaging models and delivery; chat currently shows an explicit unavailable state.
- Server-backed shop inventory, Orange spending, and gift fulfillment.
- Authored-reply/repost timelines, social-link persistence, and profile media upload need additional backend/UI work.
- Telegram Login Widget integration (depends on Privy social provider config).
- SIWE signing UI after privacy/ToS approval and `SIWE_AUTH_ENABLED` activation.
- JustaName challenge signing UI after Base SIWE, provider workspace/API-key,
  and privacy-copy approval. The secret JustaName key stays backend-only.
- Segment membership UI after EFP/Etherscan processor disclosure and
  `SEGMENTS_ENABLED` approval. `api.segments()` is wired but dormant.
- Transaction-quest start/proof UI after Base SIWE signing, reviewed quest
  content, and `QUESTS_ENABLED` approval. `api.quests()`, `startQuest()`, and
  `completeQuest()` are wired; course quizzes already prefer the new endpoint.
- Explicit read-only/retired social screens and export download UI before any
  production change from `LEGACY_SOCIAL_MODE=active`.

## Phase 2 transitions

When `PHASE.EASYCHAIN_ENABLED` flips to `true` (per `utils/easygo.js` activation gate):

- `useEasyChainProfile` switches to on-chain `PROFILE_REGISTRY` reads (already gated).
- `utils/squid.js` Lazy Liquidity behavior unchanged; backend points Squid at EasyChain destination.
- `utils/nearIntents.js` (new) takes over solver-based swaps once liquidity matures.
