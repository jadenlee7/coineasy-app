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
├── Procfile                  # independent web and segment-worker contracts
├── railway.web.json          # web start command + /ready health check
├── railway.worker.json       # private segment-worker process contract
├── package.json
├── .env.example
├── prisma/
│   ├── schema.prisma         # Phase 1 + dormant Path C v2 S1/S2 models
│   ├── migrations/           # committed social + additive Path C SQL
│   └── seed.js               # deterministic EasyGo local demo content
├── scripts/
│   ├── preflight.js          # secret-safe release environment validation
│   └── smoke.js              # read-only post-deploy probe runner
└── src/
    ├── app.js                # testable Express assembly + probes
    ├── index.js              # web process bootstrap + graceful shutdown
    ├── worker.js             # separately deployed, default-off segment loop
    ├── lib/
    │   ├── account-data.js   # authenticated local export/delete service
    │   ├── consent.js        # versioned deny-by-default consent rules
    │   ├── justaname.js      # ENS challenge, validation, and provider SDK
    │   ├── segment-rules.js  # strict v1 rule schema and evaluator
    │   ├── segment-sources.js # Base/Etherscan/EFP/local source adapters
    │   ├── segment-worker.js # consent filtering and membership reconciliation
    │   ├── quest-requirements.js # strict v1 quiz/Base quest definitions
    │   ├── quest-verifier.js # Base receipt/finality verification
    │   ├── quest-service.js  # completion + atomic Orange reward
    │   ├── advertiser-auth.js # scoped hashed-key authentication
    │   ├── admin-service.js  # campaign lifecycle + aggregate reports
    │   ├── logger.js         # redacted pino + optional Better Stack
    │   ├── telemetry.js      # optional privacy-minimized Sentry adapter
    │   ├── lifecycle.js      # bounded web shutdown contract
    │   ├── db.js             # Prisma singleton
    │   ├── privy.js          # Privy server SDK wrapper
    │   ├── squid.js          # Squid SDK wrapper (Base default)
    │   └── telegram.js       # bot wrapper (long-poll / webhook)
    ├── middleware/
    │   ├── auth.js           # requireAuth (Privy Bearer)
    │   └── legacy-social.js  # active/read-only/retired social gate
    └── routes/
        ├── auth.js           # POST /sync, GET+DELETE /me
        ├── me.js             # consent plus local data export/delete
        ├── identity.js       # gated ENS subname status/challenge/issuance
        ├── segments.js       # gated read-only current-user memberships
        ├── quests.js         # gated list/start/server-verified completion
        ├── admin.js          # gated advertiser-scoped campaign API
        ├── social.js         # public social capability metadata
        ├── orange.js         # balance/history, first reward, admin earn
        ├── profiles.js       # public and authenticated social profiles
        ├── posts.js          # posts, replies, likes, edit/delete
        ├── follows.js        # follow graph and public lists
        ├── notifications.js  # derived authenticated activity inbox
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

# Apply the committed migrations to your local Postgres
npm run prisma:deploy

# Add repeatable demo users, posts, replies, follows, likes, and Orange grants
npm run prisma:seed

# Run
npm run dev
# → liveness: http://localhost:3000/health
# → database readiness: http://localhost:3000/ready
```

The seed is non-destructive and can be run repeatedly. It also adds two dormant
`DRAFT` examples for the S5 rule format, 26 dormant course quizzes, one
dormant Base transaction quest, and one dormant advertiser/campaign pair. It
never rewrites an operator-edited segment, quest, advertiser, or campaign. It runs automatically against localhost only. For an approved shared development database, set
`ALLOW_DEMO_SEED=true` explicitly; production-like URLs are blocked by
default.

## API surface (Phase 1)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | — | Liveness probe |
| GET | `/ready` | — | Bounded database readiness probe; sanitized `503` on failure |
| POST | `/auth/sync` | Bearer | Upsert User from Privy session, award welcome 100 🍊 on first creation |
| GET | `/auth/me` | Bearer | Profile of bearer |
| DELETE | `/auth/me` | Bearer | Retired alias; always returns `410`, use the account-deletion saga |
| POST | `/auth/siwe/nonce` | Bearer + flag | Issue a 10-minute Base SIWE challenge bound to user/address |
| POST | `/auth/siwe/verify` | Bearer + flag | Consume nonce, verify EOA/smart-wallet signature, persist verified address |
| GET | `/me/consent` | Bearer | Read effective current-version consent (deny by default) |
| PUT | `/me/consent` | Bearer | Replace consent and append an audit snapshot atomically |
| GET | `/me/data` | Bearer | Export versioned EasyGo-local user data with `no-store` |
| GET | `/me/social-export` | Bearer | Download privacy-minimized social profile/content/graph data |
| GET | `/me/account-deletion` | Bearer | Read server-authoritative deletion capability and current saga state |
| POST | `/me/account-deletion` | Bearer + confirmation + flag | Idempotently request the durable deletion saga; returns `202` after local purge |
| DELETE | `/me/data` | Bearer | Retired unsafe local-only endpoint; always returns `410` after confirmation validation |
| GET | `/identity/subname` | Bearer + flag | Read local ENS issuance state |
| POST | `/identity/subname/challenge` | Bearer + flag | Request a two-minute JustaName SIWE challenge |
| POST | `/identity/issue-subname` | Bearer + flag | Verify the signed challenge and issue `<handle>.coineasy.eth` |
| GET | `/segments` | Bearer + flag | Read the current user's active consent-gated memberships; rules are omitted |
| GET | `/quests` | Bearer + flag | List available quests with only the current user's completion state |
| POST | `/quests/:id/start` | Bearer + flag | Start a quest and record required wallet-sharing opt-in |
| POST | `/quests/:id/complete` | Bearer + flag | Server-verify quiz/Base proof and atomically award Orange |
| GET | `/admin/me` | Advertiser Bearer + flag | Read the key-scoped active advertiser |
| GET/POST | `/admin/campaigns` | Advertiser Bearer + flag | List own campaigns or create an own `DRAFT` campaign |
| GET/PATCH | `/admin/campaigns/:id` | Advertiser Bearer + flag | Read or lifecycle-update an own campaign |
| GET | `/admin/campaigns/:id/report` | Advertiser Bearer + flag | Read consent-filtered, minimum-cohort aggregates |
| GET | `/social/status` | — | Discover active/read-only/retired social capability and export path |
| GET | `/orange/balance` | Bearer | Current 🍊 balance |
| GET | `/orange/history` | Bearer | Recent ledger rows |
| GET | `/orange/rewards/status` | Bearer | Server-derived daily activity and reward timers |
| POST | `/orange/claims/first-reward` | Bearer | Idempotent first 50 🍊 reward claim |
| POST | `/orange/claims/daily-checkin` | Bearer | Idempotent daily 20 🍊 claim |
| POST | `/orange/claims/daily-activity` | Bearer | Validate activity and claim 30 🍊 |
| POST | `/orange/claims/ad-reward` | Bearer | Claim one 10 🍊 reward per UTC 8-hour slot |
| POST | `/orange/claims/course-quiz` | Bearer | Idempotent allow-listed quiz reward |
| POST | `/orange/earn` | `x-admin-secret` | Server-trusted grant |
| POST | `/swap/quote` | Bearer | Squid route + unsigned tx (Base) |
| POST | `/swap/log` | Bearer | Record swap, award 10 🍊 |
| POST | `/telegram/webhook/<secret>` | path-secret | Telegram update receiver |
| GET | `/telegram/health` | — | Bot subsystem status |

`Bearer + flag` routes return `404` unless `SIWE_AUTH_ENABLED=true`. Enabling
SIWE additionally requires an exact `SIWE_DOMAIN`, matching `SIWE_URI`, a Base
RPC URL for smart-account verification, and production privacy/terms approval.
Nonces are stored only as hashes, expire after ten minutes, and are atomically
consumed to prevent replay. EOA signatures verify locally; ERC-1271/6492 smart
accounts fall back to the configured Base RPC.

`Bearer + flag` also applies to the S4 identity routes, which stay invisible
until `JUSTANAME_ENABLED=true`. JustaName's API key is server-only. The provider
issues `.eth` names on Ethereum mainnet (`JUSTANAME_CHAIN_ID=1`); EasyGo writes
both Ethereum coin type `60` and Base ENSIP-19 coin type `2147492101` for the
same Base-verified address. Configure the exact JustaName challenge authority
and URI with `JUSTANAME_DOMAIN` and `JUSTANAME_ORIGIN`.

### S5 segment worker

The worker is a separate process and is inert by default:

```bash
# one deterministic cycle during development/operations
SEGMENTS_ENABLED=true npm run worker:segments:once

# interval loop for the dedicated Railway worker service
npm run worker:segments
```

Activation requires the same published `EASYGO_CONSENT_VERSION` used by the
privacy routes, a Base RPC URL, and approved EFP/Etherscan processor copy.
`ETHERSCAN_API_KEY` is server-only and is required only when an active rule
uses `base.activity_count` or `base.active_days`.

Active `Segment.rule` values use this strict versioned shape:

```json
{
  "schemaVersion": 1,
  "match": "all",
  "membershipTtlHours": 24,
  "conditions": [
    {
      "metric": "base.erc20_balance",
      "contractAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "minimumBaseUnits": "100000000"
    },
    {
      "metric": "base.active_days",
      "minimum": 3,
      "windowDays": 30
    }
  ]
}
```

Token thresholds are unsigned base-unit strings, so worker comparisons never
use floating-point token math. Time-window activity supports minimum thresholds
only because the provider response is intentionally bounded. Raw transactions,
balances, and EFP account lists are never stored locally. See
[`docs/adr/0003-consent-gated-stateless-segment-worker.md`](./docs/adr/0003-consent-gated-stateless-segment-worker.md).

### S6 server-verified quests

The S6 routes remain invisible until `QUESTS_ENABLED=true`. Quiz responses
omit the correct-answer digest, and successful proof records omit the submitted
answer. Base transaction quests accept a transaction hash only after an
explicit start and require the transaction sender to match the user's current
Base SIWE address. The verifier also checks transaction success, configured
recipient/function/value/event constraints, post-start block time, and minimum
confirmations.

Pending, under-confirmed, or RPC-unavailable transactions return a retryable
error without erasing progress. A verified completion and its one
`QUEST_REWARD` ledger row commit in the same database transaction. When S6 is
enabled, `/orange/claims/course-quiz` returns `410` to prevent client-only
answer validation from bypassing this flow. Seeded quests are review-only
`DRAFT` records; operators must approve content, reward amounts, wallet-sharing
copy, and RPC capacity before activation. See
[`docs/adr/0004-server-verified-quest-completion.md`](./docs/adr/0004-server-verified-quest-completion.md).

### S7 advertiser campaign administration

The `/admin/*` surface stays invisible until
`ADVERTISER_ADMIN_ENABLED=true`. Each advertiser receives a high-entropy key
beginning with `eg_adv_`; only its lowercase SHA-256 digest is placed in
`ADVERTISER_API_KEY_HASHES_JSON`, mapped to the advertiser slug. The raw key is
sent only as `Authorization: Bearer <key>` and must be retained in the
advertiser's secret manager.

Every campaign lookup is constrained by the advertiser resolved from that key.
Campaigns start as `DRAFT`; activation requires an active target segment when
configured and at least one active quest. Lifecycle transitions are explicit,
and archived campaigns are immutable.

Reports require the current `EASYGO_CONSENT_VERSION`. Audience counts include
only complete, current marketing consent; targeted counts additionally require
segmenting consent and an unexpired membership. User-derived values below
`ADVERTISER_AGGREGATE_MINIMUM`—never lower than ten—are returned as suppressed
`null` values. No admin response includes user IDs, Privy identities, wallet
addresses, segment rules, quest requirements, answers, or proof JSON. See
[`docs/adr/0005-scoped-advertiser-admin-aggregates.md`](./docs/adr/0005-scoped-advertiser-admin-aggregates.md).

### S8 staged social retirement

The current mobile app actively uses `/posts`, `/profiles`, `/follows`, and
`/notifications`, so S8 ships retirement capability without activating it.
`LEGACY_SOCIAL_MODE` supports:

- `active` (default): existing reads and writes continue;
- `read_only`: reads continue, mutations return `410`; and
- `retired`: all covered social reads and writes return `410`.

Missing or invalid values resolve to `active`. Every `410` body and
`GET /social/status` response contains current capability, optional
`LEGACY_SOCIAL_SUNSET_AT`, and the stable `/me/social-export` path. The export
remains available in every mode and excludes identity/contact identifiers,
wallets, SIWE, consent, segments, quests, swaps, and Orange history. S8 does
not delete or archive any database row. See
[`docs/adr/0006-stage-legacy-social-retirement.md`](./docs/adr/0006-stage-legacy-social-retirement.md).

### S9 observability and process split

S9 adds request IDs, separate liveness/readiness probes, bounded graceful
shutdown, and explicit `web`/`worker` Procfile commands. It does not change a
feature flag or database schema.

Pino always writes structured stdout logs in production. Sentry and Better
Stack are optional: leave their environment values blank for a fully supported
local/default configuration. When enabled, request/user PII, auth/cookie/admin
headers, request bodies, query strings, Privy IDs, wallet addresses, SIWE
signatures, and quiz answers are stripped or redacted before transport.

Deploy the web and segment worker as separate Railway services from the same
release. Point web readiness at `/ready`; expose no public worker port. See
[`docs/OPERATIONS.md`](./docs/OPERATIONS.md) for environment values, alerts,
restart drills, and rollback, and
[`docs/adr/0007-optional-privacy-minimized-observability.md`](./docs/adr/0007-optional-privacy-minimized-observability.md)
for the decision record.

### Dependency security gate

The lockfile overrides JustaName's transitive `axios` and `qs` versions with
patched releases. The current production audit still reports 25 findings from
the existing Squid, Telegram, and Privy/Solana dependency trees (including two
critical findings under Telegram's deprecated `request` stack). Their offered
automatic fixes change direct dependency majors or downgrade Squid, so
`npm audit fix --force` is intentionally not part of setup. Review and test
those three integrations before a production launch; keep their feature flags
or credentials disabled until that review is complete.

## Social (PR #9)

Phase 1 self-hosted social backend, progressively replacing the legacy Orbis
dependency. Twitter-style flat
thread model: every content unit is a `Post`; replies are Posts with
`parentPostId` pointing at the parent.

### Models added
- `User` — extended with social profile fields plus dormant SIWE verification
  state (`verifiedAddress`, Base chain ID, verification time, hashed nonce).
- `Post` — thread node with a nullable author and explicit redaction timestamp.
- `Follow` — composite PK `(followerId, followeeId)`.
- `Like` — composite PK `(postId, userId)`.

`Post.mediaUrl` is reserved now to avoid a second migration when media
upload lands in PR #10.

### Path C v2 S2 models (dormant)

The schema now includes eight additive tables for the later privacy, quest,
segment-worker, and advertiser stages:

- `UserConsent` + `UserConsentAudit`
- `Quest` + `QuestCompletion`
- `Segment` + `UserSegment`
- `Advertiser` + `Campaign`

S2 introduces no endpoint and enables no feature flag. Segmenting, marketing,
and per-quest wallet sharing default to `false`. Per-user raw activity evidence
is intentionally absent from `UserSegment`; advertisers are designed to consume
aggregate campaign results only. See
[`docs/adr/0001-path-c-v2-data-model.md`](./docs/adr/0001-path-c-v2-data-model.md)
for the decision record.

S3 uses these tables at `/me/consent` and `/me/data`. Consent updates require
the exact current policy version and complete terms/privacy acceptance before
optional processing can be enabled. Set `EASYGO_CONSENT_VERSION` to the
approved published version in production; consent reads fail closed with
`503` when it is missing. New grants or permission expansion through
`PUT /me/consent` additionally require the default-off
`CONSENT_GRANTS_ENABLED=true` release gate; revocation remains available while
the gate is off.

Account deletion is a durable, asynchronous saga. The request body is:

```json
{
  "confirmation": "DELETE_MY_EASYGO_ACCOUNT",
  "clientRequestId": "11111111-1111-4111-8111-111111111111",
  "walletRiskAcknowledged": true
}
```

Once a later reviewed release removes the activation brake,
`POST /me/account-deletion` returns `202` only after the user row and owned
content have been locally purged and a permanent HMAC tombstone prevents that
same Privy DID from passing `/auth/sync`. Other users' replies remain attached
to redacted thread placeholders. A new Privy DID for the same Apple identity is
not covered by this foundation and is an activation blocker. Apple and Privy
cleanup continue as later saga stages, so the response never claims that
provider or blockchain data is gone.

Both older delete endpoints return `410` and never perform deletion. The public
request stays behind `ACCOUNT_DELETION_ENABLED=false`; this release also has a
compile-time and preflight brake that rejects activation until the worker,
stable Apple identity guard, and mobile marker exist. HMAC-key fingerprints
make accidental key replacement fail closed. See
[`docs/adr/0008-durable-account-deletion-saga.md`](./docs/adr/0008-durable-account-deletion-saga.md).

### Migration

```bash
cd backend
npm run preflight:staging
npm run prisma:status
npm run prisma:deploy
npm run prisma:status
npm run prisma:generate
```

The committed `20260721143000_path_c_v2` migration is generated from the
existing social schema and contains additive SQL only. Apply it once from a
controlled staging release job after a backup; web and worker startup never run
migrations. Do not create a second migration for the same schema changes.

### Cursor pagination

Lists return `{ rows, nextCursor }`. `nextCursor === null` means end of
stream. Pass it back as `?cursor=...&limit=...` for the next page.
Default limit 20 (50 for follow lists), max 100 (200 for follow lists).

### API additions

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/profiles/me` | Bearer | Own profile + counts |
| PUT | `/profiles/me` | Bearer | Edit username/displayName/pfp/bio |
| GET | `/profiles/by-username/:username` | — | Public lookup by handle |
| GET | `/profiles/search?q=...` | — | Search username/display name |
| GET | `/profiles/:userId` | — | Public lookup by id |
| GET | `/profiles/:userId/followers` | — | Paginated followers |
| GET | `/profiles/:userId/following` | — | Paginated following |
| GET | `/posts` | optional Bearer | Global feed; optional `q`/`tag` filters, cursor |
| GET | `/posts/by-author/:userId` | optional Bearer | User timeline (root posts), cursor |
| GET | `/posts/:id` | optional Bearer | Single post + author summary |
| GET | `/posts/:id/replies` | optional Bearer | Replies cursor |
| POST | `/posts` | Bearer | Create root post or reply |
| PUT | `/posts/:id` | Bearer | Edit own post body/media URL |
| DELETE | `/posts/:id` | Bearer | Delete own post (403 if not author) |
| POST | `/posts/:id/like` | Bearer | Like (idempotent) |
| DELETE | `/posts/:id/like` | Bearer | Unlike (idempotent) |
| POST | `/follows/:targetUserId` | Bearer | Follow (idempotent) |
| DELETE | `/follows/:targetUserId` | Bearer | Unfollow (idempotent) |
| GET | `/follows/:targetUserId/status` | Bearer | Viewer-relative follow state |
| GET | `/notifications` | Bearer | Recent follows, likes, and replies derived from social tables |

Notifications are derived at read time from `Follow`, `Like`, and reply `Post`
rows. Phase 1 therefore needs no notification migration; durable read markers
and push subscriptions are deferred.

`optional Bearer` means: a valid Bearer enriches the response (e.g.
`likedByMe`); missing/invalid Bearer returns the public payload, never
401.

### Frontend wiring

The feed, post/reply composer, profile/follow, discovery, notification, reward,
and course groups now use EasyGo endpoints. Course reading progress is kept on
device while quiz rewards are recorded in the Orange ledger. Messaging and
shop fulfillment remain explicit unavailable states until their backend
models ship. The legacy social-service compatibility shim has been removed.

## Phase 2 activation gate

EasyChain wiring (chainId switch, PHASE.EASYCHAIN_ENABLED → true) only when one of:
- 5k+ MAU sustained 2 months, **or**
- $50k+/month recurring revenue, **or**
- 3+ partner LOIs, **or**
- A strategic event (e.g. EasyChain mainnet launch with co-marketing).

Otherwise re-evaluate at 9 months.

---

## Path C v2 (in flight)

The backend is pivoting from "self-hosted social app" to **"Web2 onboarding +
onchain segmenting + advertiser campaigns"** while keeping Phase 1 surfaces
(`/auth`, `/orange`, `/swap`, `/telegram`) running.

High-level loops:

1. **Onboarding**: Privy embedded smart wallet on Base, optional ENS subname
   via JustaName (`<handle>.coineasy.eth`). ENS issuance is on Ethereum
   mainnet and includes a Base-specific address record.
2. **Engagement**: quizzes and on-chain trade quests reward 🍊 Orange.
3. **Distribution**: a segmenter worker tags users from on-chain behaviour
   (EFP follows, ERC-20 balances, swap activity). Advertisers target
   segments and receive only aggregate metrics.

### Feature flags

All Path C v2 routes ship behind `PHASE.*` flags in `utils/easygo.js`. They
all default to `false` and are flipped per-environment via env vars when the
corresponding PR ships:

| Flag                       | Activates                                         | PR  |
| -------------------------- | ------------------------------------------------- | --- |
| `SIWE_AUTH_ENABLED`        | SIWE verification path in `/auth/sync`            | S1  |
| `JUSTANAME_ENABLED`        | `/identity/subname*`, `/identity/issue-subname`   | S4  |
| `SEGMENTS_ENABLED`         | Segment worker + `/segments` (read-only, off)     | S5  |
| `QUESTS_ENABLED`           | `/quests`, `/quests/:id/{start,complete}` (off)   | S6  |
| `ADVERTISER_ADMIN_ENABLED` | `/admin/*` (advertiser-scoped, separate API keys, off) | S7  |

Routes guarded by an off flag return `404` so the surface is invisible in
production until the matching PR lands and the env var is set.

S8 uses the separate `LEGACY_SOCIAL_MODE` lifecycle gate rather than a boolean
`PHASE` flag. It must remain `active` until a compatible client, published
sunset, support plan, and verified export flow are all in place.

### Privacy & consent (binding)

- Linking Privy identity (email / social) to a wallet address makes our DB a
  PII processor. Privacy policy and ToS reflect this before any segmenting
  ships.
- `UserConsent.segmentingOptIn` defaults to `false`. The segmenter skips
  users without explicit opt-in.
- Advertisers see **aggregate metrics only**. Wallet-address sharing requires
  an explicit, timestamped per-quest opt-in on `QuestCompletion`; verifier
  proof JSON is not treated as consent by itself.
- `/me/data` (read), `/me/consent` (toggle), and the account-deletion saga
  ship in S3, before any advertiser campaign goes live.

See [`docs/BACKEND_ROADMAP.md`](./docs/BACKEND_ROADMAP.md) for the full
sequenced PR plan (S0..S9) and locked-in architectural decisions.
