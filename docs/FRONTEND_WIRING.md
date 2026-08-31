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
| Check-in/activity cards | `POST /orange/claims/{daily-checkin,daily-activity}` | Validate and idempotently record recurring rewards. |
| Dormant ad-reward backend | `POST /orange/claims/ad-reward` | Retained for old-client compatibility; the App Store mobile graph has no ad card or client call. |
| Course quiz compatibility fallback | `POST /orange/claims/course-quiz` | Used only while the S6 route is hidden; returns `410` after `QUESTS_ENABLED=true`. |
| EASYEDU → Base Route Estimate Lab | `POST /swap/quote-preview` | Educational, read-only Base ETH ↔ USDC estimate. The server derives the authenticated wallet and returns a display-only projection with no executable transaction data or Orange reward. |
| Removed mobile execution clients | `POST /swap/quote`, `POST /swap/log` | No App Store mobile symbol or API client calls these dormant server-only legacy routes; the server still returns `404`. |
| `useFeed('home')` / `usePosts()` | `GET /posts` | Read the global social feed with cursor pagination. |
| `useFeed('category', { tag })` | `GET /posts?tag=...` | Read a hashtag category with server-side cursor filtering. |
| `useFeed('search', { query })` | `GET /posts?q=...` | Search root-post bodies without breaking pagination. |
| Search people | `GET /profiles/search?q=...` | Discover profiles by username or display-name substring. |
| `usePosts({ authorId })` | `GET /posts/by-author/:userId` | Read a user's root-post timeline. |
| `usePosts.create(...)` | `POST /posts` | Publish a root text post and update mounted feeds. |
| Post editor | `PUT /posts/:id` | Edit the authenticated author's post body/media URL. |
| Post report modal | `POST /posts/:id/report` | Persist one authenticated, bounded report per reporter/post pair; replay is idempotent and exposes no reporter identity or queue totals. |
| `useReplies.create(...)` | `POST /posts` | Publish a reply using `parentPostId`. |
| `useSocialProfile(userId)` | `GET /profiles/:userId` | Read public profile details and live post/follow counts. |
| Own profile | `GET /profiles/me` | Read the authenticated user's private profile projection, including their wallet address. |
| Profile editor | `PUT /profiles/me` | Update the authenticated user's display name and bio; the private response retains their wallet address. |
| `useFollow(userId)` | `GET/POST/DELETE /follows/:userId[/status]` | Read and update viewer-relative follow state. |
| Profile mutual counts | `GET /profiles/:userId/followers` | Compare follower summaries for the selected and current user. |
| Post menu / Settings safety list | `GET /blocks`; `POST/DELETE /blocks/:userId` | Persist an account-owned block, remove the selected card after server acceptance, and list/unblock it after relogin. |
| `useNotifications()` | `GET /notifications` | Derive recent follows, likes, and replies for the authenticated user. |
| `notifyTelegram(...)` | _(none — server-driven)_ | Backend reacts to domain events; client noop. |

When the post composer is opened from a selected category, it appends the
category hashtag at publish time if the body does not already contain it.

After owner-bound auth sync, the app reads every `/blocks` page before replacing
that owner's device cache. New entries are stored by EasyGo user ID, while
historical DID entries remain readable until explicitly cleared. A partial
request, account/session transition, or newer same-owner block mutation cannot
commit an older snapshot. Feed cards,
people results, and recent profiles re-check both identity forms immediately;
one unblock removes only the selected EasyGo ID and never clears other blocks.

## Auth flow (Phase 1)

1. App boot wraps tree in `<PrivyProvider>` with `EXPO_PUBLIC_PRIVY_APP_ID`.
2. On `usePrivy()` → `authenticated === true`, `useAuthSync(privy)` runs once:
   - Calls `setApiTokenProvider(() => privy.getAccessToken(), privy.user.id)` so the token provider is bound to the active Privy owner.
   - `POST /auth/sync` with empty body; backend reads `req.user` from the verified token (see `backend/src/middleware/auth.js`).
   - Backend upserts on `privyDid`, captures linked accounts (telegram, kakao, embedded wallet address), returns `{ user, isNew }`, and awards welcome 🍊 on first creation.
3. Every private, viewer-relative, or mutating `api.*` call requires the
   `expectedAuthUserId` captured from the screen's device-account session
   lease. Before `fetch`, the API client verifies that the provider binding is
   unchanged and that the access-token `sub` is the expected Privy DID. A
   logout, account switch, or same-DID re-login invalidates older work; its
   late response cannot update state, show an alert, publish a social event, or
   start a chained request for the replacement session.
4. Public profile discovery, public follower/following lists, and the social
   capability endpoint explicitly use `auth: false`. Requests default to no
   authentication, so a newly added endpoint cannot accidentally borrow a
   token unless it deliberately chooses the owner-bound path.
5. Subsequent screens use `api.me({ expectedAuthUserId })` /
   `useEasyChainProfile` to read identity state.
6. On the authenticated user's profile, `useEasyGoWalletRuntime` asks the
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
required. On-device search history, safety lists, push-token registration, and
course progress now use SHA-256 owner namespaces, a same-session lease, and a
per-owner mutation queue. The deletion marker seals that owner before the
request; purge drains earlier writes, removes and verifies only that namespace,
and cannot touch a replacement account. Unattributable legacy global values
are discarded without being shown or copied. The main authenticated UI remains
closed until the current owner snapshot is ready. Temporary export creation and
stale cleanup are also serialized. Automated race coverage passes, while the
physical A/B transition matrix remains an activation check.

`showNotificationDate` and `showNewFeatureDate` are the only remaining global
AsyncStorage values in this UI path. They are intentionally device-wide modal
dismissal dates, contain no account identifier or user content, and are not
treated as account export/deletion data. Their asynchronous readers still
capture the full account transition so an old continuation cannot open or
close a modal for the next session.

## Base Route Estimate Lab (educational preview only)

The EASYEDU/Trophies lab is deliberately separate from any swap execution:

```
Client                                      Backend                         Squid
  │ explicit Estimate route tap               │                              │
  │ POST /swap/quote-preview {tokens,amount}   │                              │
  ├───────────────────────────────────────────▶│ derive authenticated wallet  │
  │                                             │ Base 8453 + quoteOnly route  │
  │                                             ├─────────────────────────────▶│
  │                                             │◀─────────────────────────────┤
  │ { preview, defaultChain }                   │ sanitize display fields only │
  │◀────────────────────────────────────────────┤                              │
  │ render amount/minimum/fees/time/path        │                              │
  │ clear after 20 s/background/session change  │                              │
```

The client cannot supply a sender, recipient, chain, slippage, or arbitrary
token. The backend derives both addresses from the authenticated user's stored
wallet, fixes both chains to Base `8453`, fixes slippage to 1%, and permits only
the reviewed Base native ETH/USDC pair. Although Squid is asked for
`quoteOnly:true`, the backend still treats the upstream response as untrusted
and allowlists display scalars; transaction requests, targets, calldata, calls,
quote IDs, and raw route params never cross the preview boundary. The screen
does not import a signer or execution helper and never calls `/swap/log`, so a
preview cannot award Orange. The public wallet address is disclosed to Squid
only after the user explicitly taps the preview button, consistent with the
published privacy copy.

The App Store client physically omits the old quote-execution helper, wallet
signer/broadcast code, execution API client, reward-log client, Invite reward
screen, Ad reward claim surface, and Orange Shop/Gift/conversion screens.
Orange is presented only as non-transferable, non-redeemable in-app progress;
the daily participation design still requires a separate Guideline 3.1.5(v)
classification before App Store submission. `utils/squidPreview.js` contains only the
display-preview request and session-lease checks. Run `npm run
appstore:bundle-check -- <ios-bundle>` as a release gate so execution and
reward-log markers cannot return to the exported JavaScript bundle.

Do not infer execution readiness from this lab. The server fail-closes both
legacy endpoints with
`SWAP_EXECUTION_READY=false` plus the default-off `SWAP_EXECUTION_ENABLED`
runtime kill switch. An environment change cannot expose them until a
separately reviewed release changes the compile-time brake after execution and
reward verification are implemented. Railway deployment and runtime 404
evidence remain separate checklist gates.

## Environment variables (client)

Already defined in repo-root `.env.example` (PR #4):

- `EXPO_PUBLIC_BACKEND_URL` — required for `utils/api.js` to function.
- `EXPO_PUBLIC_PRIVY_APP_ID` — required for Privy SDK at app boot.
- `EXPO_PUBLIC_PRIVY_CLIENT_ID` — EasyGo mobile client identifier for the app bundle and URL scheme.
- `EXPO_PUBLIC_TG_BOT_USERNAME` / `EXPO_PUBLIC_TG_WEBAPP_URL` — for `getTelegramLoginUrl`.
- `EXPO_PUBLIC_EASYGO_CONSENT_VERSION` — exact version shared by the published
  EasyGo Terms and Privacy documents.
- `EXPO_PUBLIC_EASYGO_TERMS_URL` / `EXPO_PUBLIC_EASYGO_PRIVACY_URL` — versioned
  HTTPS documents whose URL path contains the exact consent version. Consent
  editing stays locked while either is missing, both resolve to the same URL,
  the version differs from the backend, or the backend returns
  `consent.grantsEnabled=false`.
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
  `GET /me/consent` exposes this as `consent.grantsEnabled`; clients must treat
  a missing field as `false` during rolling deployments. Revocation does not
  depend on this capability.
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
- **Privy not yet authenticated or account changed**: owner-bound requests fail
  locally before `fetch`; they never degrade into an anonymous request or use a
  replacement account's bearer. A social request with no Authorization header
  still has the public anonymous projection; once a bearer is supplied, an
  invalid, expired, or unsynced identity returns `401` and never falls back to
  that projection. Signed-in mobile discovery reads always send the captured
  owner so account block filtering applies.
- **Wallet chain/account mismatch**: the profile displays a retryable warning
  instead of claiming Base connectivity. Transaction features must remain
  unavailable unless the same runtime attestation reports `ready`.
- **Preview unavailable**: the read-only screen maps fixed 400/401/409/429/502
  categories to credential-free retry copy. It never renders the upstream
  error body. An account/session change, app background, input change, or
  20-second expiry aborts or discards the in-memory preview.

## Daily Run MVP (local, account-bound)

`Home -> DailyRun` provides the first seven-day beginner loop documented in
`docs/EASYGO_DAILY_RUN_MVP.md`. Its only reward is local Knowledge XP derived
from known one-time lesson completions. The progress object lives in the
hashed, owner-scoped `daily-run-progress` device slot and uses the same
account/session lease as course progress, hidden posts, and recent profiles.

The signed-out 30-second sample is deliberately ephemeral. It does not write
progress or migrate into the next authenticated account. Daily Run never calls
an Orange claim, swap execution, signing, or broadcast API. BaseScan and the
existing display-only quote preview are educational outbound actions only;
the optional Day 7 share sheet appears after completion and provides no XP.

## Remaining screen migrations

- Media upload plus repost/quote relationships.
- Push registration activation, delivery worker, and notification-send policy.
  The owner-bound `PUT`/`DELETE /me/push-token` implementation and account
  deletion cascade are present, but paired compile-time and environment brakes
  keep registration off while the current policy says tokens remain on-device.
  Activation requires a new versioned privacy document and physical-device QA;
  no remote notification sender is active.
- Messaging models and delivery; chat currently shows an explicit unavailable state.
- Server-backed shop inventory, Orange spending, and gift fulfillment.
- Authored-reply/repost timelines, social-link persistence, and profile media upload need additional backend/UI work.
- Telegram Login Widget integration (depends on Privy social provider config).
- SIWE signing UI after privacy/ToS approval and `SIWE_AUTH_ENABLED` activation.
- JustaName challenge signing UI after Base SIWE, provider workspace/API-key,
  and privacy-copy approval. The secret JustaName key stays backend-only.
- Segment membership UI after EFP/Etherscan processor disclosure and
  `SEGMENTS_ENABLED` approval. `api.segments({ expectedAuthUserId })` is wired
  but dormant.
- Transaction-quest start/proof UI after Base SIWE signing, reviewed quest
  content, and `QUESTS_ENABLED` approval. The owner-bound `api.quests`,
  `startQuest`, and `completeQuest` clients are wired; course quizzes already
  prefer the new endpoint.
- Explicit read-only/retired social screens before any production change from
  `LEGACY_SOCIAL_MODE=active`. Authenticated, account-bound full/social JSON
  export is wired in the Build 101 Settings candidate, with temporary iOS file
  cleanup and Android SAF save; physical-device verification remains pending.

## Phase 2 transitions

When `PHASE.EASYCHAIN_ENABLED` flips to `true` (per `utils/easygo.js` activation gate):

- `useEasyChainProfile` switches to on-chain `PROFILE_REGISTRY` reads (already gated).
- The Base Route Estimate Lab remains display-only unless a separate reviewed
  product and App Store release deliberately introduces a new transaction
  architecture.
- `utils/nearIntents.js` (new) takes over solver-based swaps once liquidity matures.
