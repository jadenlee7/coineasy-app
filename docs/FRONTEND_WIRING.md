# Frontend Wiring (Phase 1)

EasyGo React Native (Expo) client → EasyGo backend (Express + Prisma).
Phase 1 boundary: client never talks directly to Squid SDK or Telegram bot token; all server-state mutations go through the backend.

See `EASYGO_BUILD_PLAN.md` §11 (data flow), §12 (backend endpoints), §13.2 (Squid integration).

## Endpoint map

| Client | Backend route | Purpose |
| --- | --- | --- |
| `useAuthSync(privy)` | `POST /auth/sync` | Upsert user on Privy login; awards 100 🍊 welcome bonus on first sync. |
| `useEasyChainProfile(addr)` | `GET /auth/me` | Read profile (handle, avatar, telegram/kakao IDs). Phase 2 swaps to PROFILE_REGISTRY on-chain. |
| `useOrange(addr)` | `GET /orange/balance/:address` | Read 🍊 balance from Postgres ledger. |
| `useOrange(addr)` | `GET /orange/history/:address` | Read 🍊 ledger entries (limit-paginated). |
| `getSquidQuote(...)` | `POST /swap/quote` | Backend calls Squid SDK; returns `{ estimate, transactionRequest, params }`. |
| `executeSquidRoute(...)` | `POST /swap/log` | After Privy embedded wallet broadcasts the tx, log txHash → backend awards +10 🍊. |
| `notifyTelegram(...)` | _(none — server-driven)_ | Backend reacts to domain events; client noop. |

## Auth flow (Phase 1)

1. App boot wraps tree in `<PrivyProvider>` with `EXPO_PUBLIC_PRIVY_APP_ID`.
2. On `usePrivy()` → `authenticated === true`, `useAuthSync(privy)` runs once:
   - Calls `setApiTokenProvider(() => privy.getAccessToken())` so all subsequent `api.*` calls carry `Authorization: Bearer <Privy access token>`.
   - `POST /auth/sync` with empty body; backend reads `req.user` from the verified token (see `backend/src/middleware/auth.js`).
   - Backend upserts on `privyUserId`, captures linked accounts (telegram, kakao, email, embedded wallet address), and awards welcome 🍊 on first creation.
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
- `EXPO_PUBLIC_TG_BOT_USERNAME` / `EXPO_PUBLIC_TG_WEBAPP_URL` — for `getTelegramLoginUrl`.
- `EXPO_PUBLIC_SQUID_INTEGRATOR_ID` / `EXPO_PUBLIC_SQUID_API_URL` — surfaced in client config but actual SDK runs server-side.

## Failure modes

- **Backend unreachable** (e.g. local dev before backend is booted): `utils/api.js` returns `null` and logs a warning. Hooks set `balance = 0`, `profile = null`. UI stays usable.
- **Privy not yet authenticated**: `setApiTokenProvider` is unset; requests go without `Authorization` header and backend returns 401. Hooks treat 401/404 as "empty state" rather than error.
- **Quote returns `null`**: `getSquidQuote` swallows `ApiError` so the swap UI can show a graceful retry CTA.

## What's NOT in this PR

- Screen-level integration (e.g. wiring `useOrange` into `screens/HomeScreen.js`). That comes in PR #7 (UI wiring) once the screen graph is finalized in Figma sync.
- Privy SDK install + provider setup. Deferred until the Privy app ID is provisioned at `dashboard.privy.io`.
- Telegram Login Widget integration (depends on Privy social provider config).

## Phase 2 transitions

When `PHASE.EASYCHAIN_ENABLED` flips to `true` (per `utils/easygo.js` activation gate):

- `useEasyChainProfile` switches to on-chain `PROFILE_REGISTRY` reads (already gated).
- `utils/squid.js` Lazy Liquidity behavior unchanged; backend points Squid at EasyChain destination.
- `utils/nearIntents.js` (new) takes over solver-based swaps once liquidity matures.
