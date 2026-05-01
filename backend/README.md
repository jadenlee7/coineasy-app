# EasyGo backend (Phase 1)

Skeleton Node.js service for EasyGo Phase 1 (Path C).

- **Auth / identity:** Privy (Telegram + Kakao OAuth, embedded wallet on Base).
- **Swap:** Squid SDK proxy. Default chain = Base (chainId `8453`).
- **🍊 Orange:** Backend-DB ledger. Append-only `OrangeLedger` rows; balance = sum(delta). Not a token in Phase 1.
- **Telegram:** node-telegram-bot-api. Long-poll in dev, webhook in prod.
- **DB:** Postgres via Prisma.

EasyChain integration is Phase 2-gated (`PHASE.EASYCHAIN_ENABLED` flag in `utils/easygo.js`).

## Layout

```
backend/
├── package.json
├── .env.example
├── prisma/
│   └── schema.prisma         # User / OrangeLedger / SwapLog
└── src/
    ├── index.js              # Express bootstrap
    ├── lib/
    │   ├── logger.js         # pino
    │   ├── db.js             # Prisma singleton
    │   ├── privy.js          # Privy server SDK wrapper
    │   ├── squid.js          # Squid SDK wrapper (Base default)
    │   └── telegram.js       # bot wrapper (long-poll / webhook)
    ├── middleware/
    │   └── auth.js           # requireAuth (Privy Bearer)
    └── routes/
        ├── auth.js           # POST /sync, GET /me
        ├── orange.js         # GET /balance, /history, POST /earn (admin)
        ├── swap.js           # POST /quote, POST /log
        └── telegram.js       # POST /webhook/<secret-path>, GET /health
```

## Local setup

```bash
cd backend
cp .env.example .env
# fill in PRIVY_APP_ID / PRIVY_APP_SECRET / SQUID_INTEGRATOR_ID /
# TELEGRAM_BOT_TOKEN / DATABASE_URL / ADMIN_SECRET / TELEGRAM_WEBHOOK_SECRET

# Install + generate Prisma client
npm install
npm run prisma:generate

# Apply schema to your local Postgres
npm run prisma:migrate -- --name init

# Run
npm run dev
# → http://localhost:3000/health
```

## API surface (Phase 1)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | — | Liveness probe |
| POST | `/auth/sync` | Bearer | Upsert User from Privy session, award welcome 100 🍊 on first creation |
| GET | `/auth/me` | Bearer | Profile of bearer |
| GET | `/orange/balance` | Bearer | Current 🍊 balance |
| GET | `/orange/history` | Bearer | Recent ledger rows |
| POST | `/orange/earn` | `x-admin-secret` | Server-trusted grant |
| POST | `/swap/quote` | Bearer | Squid route + unsigned tx (Base) |
| POST | `/swap/log` | Bearer | Record swap, award 10 🍊 |
| POST | `/telegram/webhook/<secret>` | path-secret | Telegram update receiver |
| GET | `/telegram/health` | — | Bot subsystem status |

## Phase 2 activation gate

EasyChain wiring (chainId switch, PHASE.EASYCHAIN_ENABLED → true) only when one of:
- 5k+ MAU sustained 2 months, **or**
- $50k+/month recurring revenue, **or**
- 3+ partner LOIs, **or**
- A strategic event (e.g. EasyChain mainnet launch with co-marketing).

Otherwise re-evaluate at 9 months.
