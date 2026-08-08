# Frontend Wiring (Phase 1)

EasyGo React Native (Expo) client → EasyGo backend (Express + Prisma).
Phase 1 boundary: client never talks directly to Squid SDK or Telegram bot token; all server-state mutations go through the backend.

See `EASYGO_BUILD_PLAN.md` §11 (data flow), §12 (backend endpoints), §13.2 (Squid integration).

## Endpoint map

| Client | Backend route | Purpose |
| --- | --- | --- |
| `useAuthSync(privy)` | `POST /auth/sync` | Upsert user on Privy login; awards 100 🍊 welcome bonus on first sync. |
| Account deletion status | `GET /me/account-deletion` | Read the server capability or recover an existing durable deletion tombstone. Recovery remains available while creation is gated. |
| Apple deletion reauth | `POST /me/account-deletion/reauth/challenge` | Request a short-lived nonce/state bound to the authenticated DID and deletion `clientRequestId`. Dormant while the recent-auth latch is closed. |
| Apple deletion reauth | `POST /me/account-deletion/reauth/verify` | Submit the native Apple identity token plus challenge nonce/state for server verification; returns a short-lived opaque proof, never an Apple token. |
| Settings deletion confirmation | `POST /me/account-deletion` | Consume `challengeId` plus `reauthProof` atomically with the idempotent local-purge tombstone. New requests remain unavailable. |
| Retired deletion alias | `DELETE /me/data` | Always returns the moved/retired response; it cannot bypass recent reauthentication or the deletion saga. |
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
| Own profile | `GET /profiles/me` | Read the authenticated user's private profile projection, including their wallet address. |
| Profile editor | `PUT /profiles/me` | Update the authenticated user's display name and bio; the private response retains their wallet address. |
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
4. On the authenticated user's profile, `useEasyGoWalletRuntime` asks the
   embedded EIP-1193 provider for `eth_chainId` and `eth_accounts`. The UI shows
   `Base · Connected` only when the chain is `0x2105` and both the provider and
   backend profile identify the same wallet. The address button remains
   copy-only; the separate status badge opens BaseScan.

Public profile/search responses never include `walletAddress`. The signed-in
user still receives their address from `/auth/sync`, `/auth/me`, and the
authenticated `/profiles/me` projection.

## Dormant account-deletion reauthentication

The settings UI does not treat the current Privy bearer token as recent
authentication. After the server reports deletion available and the user
acknowledges wallet risk and types `DELETE`, the dormant iOS flow is:

1. Create one `clientRequestId` and keep the expected Privy DID fixed for the
   entire destructive flow.
2. Request `/me/account-deletion/reauth/challenge` using owner-bound auth. The
   server first requires the current DID's immutable local Apple mapping, then
   returns a challenge ID, nonce, state, and short expiry.
3. Call Expo's native `AppleAuthentication.signInAsync({ nonce, state })` while
   the existing Privy session remains active. Do not call Privy's login or
   linking hooks for reauthentication.
4. Send only the challenge ID, request ID, expected DID, Apple identity token,
   nonce, and state to `/reauth/verify`. The server verifies Apple's RS256 JWT,
   native-app audience, challenge values, and stable Apple subject mapping,
   then returns an opaque `reauthProof`.
5. Persist the existing local deletion marker before sending the final
   `POST /me/account-deletion` with the same request ID, `challengeId`, and
   `reauthProof`. The backend consumes the proof in the local-purge transaction.
   Writing the marker replaces Settings with the pending safety screen; only
   that still-mounted, live-owner screen may purge device state or log out
   after an authoritative accepted/tombstoned response.

If the final POST response is lost, the pending screen checks status first. A
found tombstone is reconciled without another proof. If no tombstone exists,
it runs a new Apple prompt and retries with the marker's original request ID;
challenge secrets and proofs remain memory-only.

Cancellation, challenge expiry, subject mismatch, account switch, or server
verification failure sends no deletion request and leaves the session and
account intact. The client never logs or persists the identity token, raw
nonce/state, or proof. It sends neither `authorizationCode` nor `appleUser`;
authorization-code exchange, refresh-token custody, and Apple revocation are
separate activation blockers.

Status and idempotent recovery for an existing deletion tombstone intentionally
skip a new Apple prompt. They restore an already-authorized request and cannot
create another one.

This entire path remains dormant: `ACCOUNT_DELETION_RECENT_AUTH_READY` is
`false`, alongside the public-request, stable-identity, and provider-cleanup
compile latches, and `ACCOUNT_DELETION_RECENT_AUTH_ENABLED` remains off. No
Railway environment variable can bypass a compile latch in the current release.
Physical-device proof of Apple's raw-versus-transformed nonce behavior and
native-versus-Privy Apple subject equivalence is still required through a
reviewed internal diagnostic that cannot call deletion and is removed before a
release build. Google-only and Android reauthentication designs are also still
required. The current global AsyncStorage search/safety keys must also become
owner-scoped (or account switching must be serialized with their non-abortable
cleanup) before this path is activated.

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
- `EXPO_PUBLIC_EASYGO_CONSENT_VERSION` — exact version shared by the published
  EasyGo Terms and Privacy documents.
- `EXPO_PUBLIC_EASYGO_TERMS_URL` / `EXPO_PUBLIC_EASYGO_PRIVACY_URL` — versioned
  HTTPS documents. Consent editing stays locked while either is missing or the
  version differs from the backend.
- `EXPO_PUBLIC_EASYGO_HELP_URL` — optional replacement for the current help link.

Run `npm run preflight` before local builds and `npm run preflight:staging`
before an EAS staging build. Privy's native app allowlist must contain the
actual identifiers from `app.json`: iOS `com.coineasy.coineasysocial`, Android
`com.coineasy.coineasy`, and URL scheme `coineasyapp`. The Android package is
not the same as the iOS bundle identifier; both must be registered for the same
mobile client if that client is used on both platforms.

## Failure modes

- **Backend URL unset**: `utils/api.js` returns `null` and logs a warning. Hooks expose an unconfigured empty state, so the UI stays usable.
- **Consent policy version unset in production**: `/me/consent` returns `503` until the backend's `EASYGO_CONSENT_VERSION` matches the approved published policy version.
- **Consent grant gate off**: `PUT /me/consent` rejects new grants or permission
  expansion while `CONSENT_GRANTS_ENABLED` is false or missing, even if a
  staging policy version exists. Revocation remains available. This is the
  required state until the EasyGo documents and App Store privacy disclosures
  are approved.
- **Account deletion gates off**: Settings keeps new deletion unavailable;
  challenge/verification and `POST /me/account-deletion` fail closed while the
  compile-time or Railway gates are closed. `GET /me/account-deletion` can
  still recover an existing tombstone. Retired `DELETE /me/data` and the
  unconfirmed legacy `/auth/me` deletion alias always return `410`.
- **Apple reauthentication fails or is cancelled**: The client shows fixed,
  credential-free copy and sends no deletion request. It must not fall back to
  the current Privy access token, a DID-only check, or an account-linking flow.
- **Backend unreachable**: requests throw and feed screens expose a retry state while retaining any previously loaded rows.
- **Quest flag off**: course completion receives `404` from `/quests` and falls back to the legacy reward route, so the current app remains usable during rollout.
- **Social mode**: `active` preserves current behavior. A future `read_only` mode returns `410` only for writes; `retired` returns `410` for all social routes. Both responses include `/me/social-export`.
- **Privy not yet authenticated**: `setApiTokenProvider` is unset; requests go without `Authorization` header and backend returns 401. Hooks treat 401/404 as "empty state" rather than error.
- **Wallet chain/account mismatch**: the profile displays a retryable warning
  instead of claiming Base connectivity. Transaction features must remain
  unavailable unless the same runtime attestation reports `ready`.
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
- Explicit read-only/retired social screens before any production change from
  `LEGACY_SOCIAL_MODE=active`. Authenticated, account-bound full/social JSON
  export is wired in the Build 101 Settings candidate, with temporary iOS file
  cleanup and Android SAF save; physical-device verification remains pending.

## Phase 2 transitions

When `PHASE.EASYCHAIN_ENABLED` flips to `true` (per `utils/easygo.js` activation gate):

- `useEasyChainProfile` switches to on-chain `PROFILE_REGISTRY` reads (already gated).
- `utils/squid.js` Lazy Liquidity behavior unchanged; backend points Squid at EasyChain destination.
- `utils/nearIntents.js` (new) takes over solver-based swaps once liquidity matures.
