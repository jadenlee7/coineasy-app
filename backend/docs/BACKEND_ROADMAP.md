# Backend Roadmap — Path C v2

Status: S1 and S4–S9 are implemented behind safe default-off/active gates. S2's
eight-table Prisma model, additive migration SQL, and S3's consent/privacy routes
are implemented; migration application still requires an approved staging database. Production
activation remains blocked on privacy/ToS approval and environment/provider
configuration. The locked production dependency tree also has 25 unresolved
audit findings in the legacy Squid, Telegram, and Privy/Solana integrations;
their major-version remediation is a production gate, not an automatic force
upgrade.
Owner: @jadenlee7
Scope: `backend/` only. Frontend changes are tracked separately under `coineasy-app` root.

---

## 1. Why this pivot

Phase 1 backend (PR #5 → PR #9) is a self-hosted social + 🍊 Orange ledger on
Postgres, with Privy auth and a Squid swap proxy. It works, but it puts coineasy
in the "another social app" lane and gives us no defensible moat.

**Path C v2** repositions the backend around three loops:

1. **Web2 onboarding via quizzes and rewards.** New users sign in with Privy
   (email / social), get an embedded smart wallet on Base, and immediately enter
   a quiz/quest funnel that drops 🍊 Orange + (optionally) on-chain rewards.
2. **Onchain activity becomes the moat.** Every quest completion is verifiable
   on Base. Every swap, follow on EFP, ENS subname issuance, and token movement
   feeds the segmenter.
3. **Segments power advertiser-targeted campaigns.** Advertisers define a
   segment (e.g. "stable-holder-100usdc + active-base-30d"); we surface their
   quests/notifications to matching users. Advertisers only ever see aggregate
   metrics, never PII.

This document is the sequenced plan for getting the backend from Phase 1 to
this target state, one reviewable PR at a time.

---

## 2. Target architecture (backend slice)


```
                     ┌──────────────────────────────────────┐
Mobile app ────────► │  Express (existing)                  │
                     │                                      │
                     │  /auth/*          (Privy + SIWE)     │
                     │  /orange/*        (DB ledger)        │
                     │  /swap/*          (Squid proxy)      │
                     │  /identity/*      (JustaName)   NEW  │
                     │  /quests/*                      NEW  │
                     │  /me/consent      /me/data      NEW  │
                     │  /admin/*         (advertiser)  NEW  │
                     └──────────┬───────────────────────────┘
                                │
                                ▼
                     ┌──────────────────────────────────────┐
                     │  Supabase Postgres (via Prisma)      │
                     │                                      │
                     │  User, OrangeLedger, SwapLog         │
                     │  Post, Follow, Like     (legacy)     │
                     │                                      │
                     │  UserConsent            NEW          │
                     │  Quest, QuestCompletion NEW          │
                     │  Segment, UserSegment   NEW          │
                     │  Advertiser, Campaign   NEW          │
                     └──────────┬───────────────────────────┘
                                ▲
                                │
                     ┌──────────┴───────────────────────────┐
                     │  Worker process (separate Procfile)  │
                     │                                      │
                     │  - Base RPC balance reader           │
                     │  - Etherscan V2 activity reader      │
                     │  - EFP API stats reader              │
                     │  - Segment evaluator                 │
                     └──────────────────────────────────────┘
```



Hosting: Railway (existing). Worker is added as a second Railway service from
the same repo, with its own start command.

DB: Supabase Postgres (existing). New tables are pure additions; no destructive
migrations in S0..S7.

---

## 3. PR sequence

Each PR is feature-flagged via `backend/utils/easygo.js` `PHASE.*` constants.
A flag staying `false` means the new route exists but returns `404` or `503`,
keeping production behavior unchanged.

| PR    | Title                                                  | Flag flipped         | DB migration | Risk |
| ----- | ------------------------------------------------------ | -------------------- | ------------ | ---- |
| S0    | Path C v2 prep (this PR)                               | —                    | none         | none |
| S1    | SIWE verification middleware ✅                        | `SIWE_AUTH_ENABLED` (off) | additive User SIWE fields | low |
| S2    | Data model expansion (schema + SQL ✅; DB apply pending) | —                    | additive (8 new tables) | low |
| S3    | Consent + privacy routes (`/me/consent`, `/me/data`) ✅ | —                    | none (uses S2 tables) | low |
| S4    | JustaName subname issuance ✅                          | `JUSTANAME_ENABLED` (off) | additive User issuance fields | low |
| S5    | Base indexer + segment worker (separate process) ✅    | `SEGMENTS_ENABLED` (off) | none    | medium |
| S6    | Quest system (quiz + tx-execute) ✅                    | `QUESTS_ENABLED` (off) | none       | medium |
| S7    | Advertiser admin (`/admin/*`) ✅                       | `ADVERTISER_ADMIN_ENABLED` (off) | none (uses S2 tables) | medium |
| S8    | Staged legacy social retirement (`410 Gone`) ✅        | `LEGACY_SOCIAL_MODE=active` | none (no deletion) | medium |
| S9    | Observability (Sentry, Better Stack, Procfile split) ✅ | —                    | none         | low |

Phase 2 chain activation (`PHASE.EASYCHAIN_ENABLED`) remains gated by the
existing criteria in `EASYGO_BUILD_PLAN.md §4.1` and is **out of scope** for
this roadmap. Path C v2 is intentionally Base-only.

---

## 4. Decisions locked in

- **Chain**: Base (chainId 8453). No Aurora.
- **Identity**: wallet verification and product activity are on Base.
  `coineasy.eth` is issued through ENS on Ethereum mainnet with an explicit
  Base ENSIP-19 address record. See ADR-0002.
- **Subname issuer**: JustaName (CCIP-Read offchain resolver).
- **Wallet/auth**: Privy retained. Embedded smart wallets on Base.
- **Gas abstraction**: Privy native paymaster (short-term). Re-evaluate
  Pimlico when sponsorship cost exceeds Privy's included quota.
- **Cross-chain routing**: Squid retained.
  IntegratorId `coineasy-f33b68ba-dba8-4571-8c26-5f09e1876f9f`.
- **Legacy Orbis data**: clean cutover, no backfill.
- **Advertiser data exposure**: aggregate-only by default. Per-quest opt-in
  required for wallet-address sharing.

---

## 5. Privacy & consent principles (binding)

These are non-negotiable for every PR S1..S9.

1. **Linking wallet ↔ identity creates PII.** The moment Privy gives us
   `email + walletAddress`, our DB is a PII processor. Privacy policy and
   terms-of-service must reflect this before S1 ships in production.
2. **Marketing analysis is opt-in.** `UserConsent.segmentingOptIn` defaults
   to `false`. The segmenter (S5) MUST skip users where this is `false`.
3. **Advertisers see aggregates by default.** Per-user wallet addresses are
   only shared when the user explicitly accepts a quest that declares
   "this quest will share your wallet address with `[Advertiser X]`".
   That per-quest opt-in is recorded explicitly on `QuestCompletion`; the
   verifier proof alone is not treated as consent.
4. **User control panel exists from day one.** `/me/data` (read),
   `/me/consent` (toggle), `/me/data` DELETE (forget) must be live before
   any advertiser campaign ships.
5. **Logs and dumps redact PII.** pino redact list must include email,
   privyId, walletAddress when log level is `info` or below.

### S1 implementation notes

- Authenticated clients request a server-created EIP-4361 message from
  `POST /auth/siwe/nonce`; clients must sign that exact text.
- The nonce is 96-bit, stored only as a SHA-256 hash, bound to the authenticated
  user and requested wallet, expires in ten minutes, and is atomically consumed.
- Domain, URI, scheme, Base chain ID, issue/expiry times, address, nonce, and
  signature are all checked. EOA verification is local; smart accounts use the
  Base public client for ERC-1271/6492-compatible verification.
- Routes stay invisible (`404`) while the feature flag is off. Production also
  rejects non-HTTPS SIWE configuration.
- Pino redacts auth headers, SIWE messages/signatures, email, Privy identity,
  wallet address, and verified address fields.

---

## 6. Out of scope

- Frontend wiring of the new endpoints. Tracked in the app PRs.
- Multi-chain content. Content is Base-only.
- Decentralization of the segment worker. v1 runs operator-managed.
- Migration of legacy `Post/Follow/Like` data. They stay until S8, which
  serves `410 Gone` and links to an exporter the user can self-serve.

---

## 7. Versioned consent

`UserConsent.consentVersion` tracks the version of the terms the user agreed
to. Any change to scope (e.g. adding a new advertiser category) bumps the
version and forces a re-consent prompt on next app launch. The
`UserConsentAudit` schema is added in S2 so S3 can write the current consent
and its audit snapshot in one transaction.

## 8. S2 data-model guardrails

S2 adds `UserConsent`, `UserConsentAudit`, `Quest`, `QuestCompletion`,
`Segment`, `UserSegment`, `Advertiser`, and `Campaign`. It adds no route and
flips no feature flag.

- Segmenting, marketing, and per-quest wallet sharing all default to `false`.
- `UserSegment` stores membership metadata only, not raw wallet activity.
- A user can have one completion per quest and one membership per segment.
- User-owned consent, completion, and membership data cascades on account
  deletion. Campaign attribution uses restricted deletes and archive statuses.
- Segment rules and verifier proofs remain JSON until S5/S6 define and validate
  their versioned payload schemas.
- The S5 worker must also require the current consent version and both terms
  and privacy acceptance timestamps; the stored opt-in boolean alone is not
  sufficient.

The decision and alternatives are recorded in
[`adr/0001-path-c-v2-data-model.md`](./adr/0001-path-c-v2-data-model.md).

The additive deploy artifact is committed at
`prisma/migrations/20260721143000_path_c_v2/migration.sql`. It was generated
from the committed social schema to the current Prisma schema and is tested to
contain every S2 table with no drop, delete, truncate, or data rewrite. Applying
it remains a controlled staging operation after backup and migration-status
review.

## 9. S3 consent and privacy routes

- `GET /me/consent` returns the effective current-version consent. Missing,
  incomplete, or stale consent always reports optional processing as disabled.
- `PUT /me/consent` accepts a complete replacement and writes the current row
  plus an immutable audit snapshot in one transaction. It returns `503` unless
  a request adds any permission and the independent, default-off
  `CONSENT_GRANTS_ENABLED` release gate has not been enabled after the
  legal-document review. Revocation remains available while the gate is off.
- `GET /me/data` returns a no-store, versioned export of records held in the
  EasyGo database. Ephemeral SIWE nonce hashes are excluded.
- `DELETE /me/data` requires the literal confirmation
  `DELETE_MY_EASYGO_DATA`, then deletes the local user and cascaded records.
  It does not claim to delete the separate Privy identity. The route remains
  `503` behind default-off `ACCOUNT_DELETION_ENABLED` until cross-user reply
  ownership and post-deletion Privy session recreation are resolved.
- Production consent reads return `503` until `EASYGO_CONSENT_VERSION` is set
  to the approved, published policy version. That version alone never enables
  mutation; the separate gate above is also required.

## 10. S4 ENS subname issuance

S4 is a two-step, authenticated flow behind `JUSTANAME_ENABLED`:

1. `POST /identity/subname/challenge` asks JustaName for a two-minute SIWE
   challenge bound to the user's Base-verified address. Only its SHA-256 hash
   and expiry are stored.
2. The wallet signs the exact message and sends it to
   `POST /identity/issue-subname`. EasyGo verifies the signature, checks
   availability, atomically locks issuance, and calls the official server SDK.

`GET /identity/subname` returns the local issuance state. Handles must be
3–20 lowercase alphanumeric characters and protected labels are rejected.
Issuance writes coin type `60` plus Base coin type `2147492101`. Interrupted
provider success is reconciled only if the external name resolves to the
user's verified address. After issuance, changing the verified address is
blocked until a future transfer/revocation flow exists.

JustaName supports issuance chain IDs `1` and `11155111`, not Base `8453`.
Production is therefore fixed to chain ID `1`; Base remains the product chain
and address-record target. The decision is recorded in
[`adr/0002-ens-mainnet-issuance-base-address.md`](./adr/0002-ens-mainnet-issuance-base-address.md).

## 11. S5 consent-gated segment worker

S5 runs as a separate `npm run worker:segments` process and exposes one
read-only authenticated endpoint at `GET /segments`. Both remain dormant or
invisible while `SEGMENTS_ENABLED=false`.

- Only users with a Base SIWE address and current-version terms, privacy, and
  explicit segmenting consent are selected.
- Version-1 rules support Base native/ERC-20 balance, Base transaction count,
  bounded recent Base activity/active days, EFP follower/following counts, and
  EasyGo Base swap counts.
- Base balances come from JSON-RPC. Bounded address history comes from
  Etherscan V2 with chain ID `8453`; EFP counts use the official public API.
- External events and balances exist only in worker memory. `UserSegment`
  stores membership metadata and a maximum seven-day expiry, never evidence.
- Source errors yield an unknown result: no membership is created and an old
  match is allowed to expire instead of being deleted on a transient outage.
- A successful no-match removes only `INDEXER` assignments. `MANUAL`
  assignments are never overwritten by the worker.
- Revoking consent deletes indexer assignments in the same consent-update
  transaction. The read endpoint independently rechecks consent and omits rule
  JSON.

The provider/privacy trade-off and future self-hosted-indexer path are recorded
in
[`adr/0003-consent-gated-stateless-segment-worker.md`](./adr/0003-consent-gated-stateless-segment-worker.md).

## 12. S6 server-verified quests

S6 exposes `GET /quests`, `POST /quests/:id/start`, and
`POST /quests/:id/complete`. All three stay invisible while
`QUESTS_ENABLED=false`; the seed creates only `DRAFT` review samples and never
activates or rewrites an operator-edited quest.

- Version-1 quiz requirements expose the question and options but omit the
  quest-scoped SHA-256 answer verifier. The server validates the submitted
  option; stored proof contains neither the answer nor its digest.
- Base transaction quests require a prior start, a current chain-8453 SIWE
  address, a mined successful transaction from that address, configured
  recipient/input/value/event predicates, a post-start block timestamp, and
  the configured confirmation count.
- Pending, under-confirmed, and RPC-unavailable proofs are retryable and keep
  progress. Definitive proof mismatches reject the attempt.
- Completion and the `QUEST_REWARD` Orange ledger row are written atomically.
  Quest/user reward references and transaction-proof locking make retries and
  concurrent submissions idempotent.
- Wallet sharing is separate from verification. It is recorded only for a
  quest that declares it and receives explicit opt-in; verifier proof never
  stores a wallet address.
- When S6 is enabled, the old allow-listed course reward endpoint returns
  `410` so a modified client cannot bypass the server answer verifier.

The synchronous verifier, privacy boundary, and future queue path are recorded
in
[`adr/0004-server-verified-quest-completion.md`](./adr/0004-server-verified-quest-completion.md).

## 13. S7 advertiser-scoped campaign administration

S7 exposes advertiser-self, campaign lifecycle, and aggregate report routes at
`/admin/*`. The entire surface returns `404` while
`ADVERTISER_ADMIN_ENABLED=false`.

- Each high-entropy Bearer key resolves through a server-side mapping of
  advertiser slug to SHA-256 digest. Raw advertiser keys are not stored in the
  database or environment configuration.
- The resolved active advertiser is the authorization scope. No request can
  select another advertiser ID, and every campaign query includes that scope.
- Campaigns are created only as `DRAFT`, use explicit lifecycle transitions,
  require an active target segment when configured, and require at least one
  active quest before activation. Archived campaigns are immutable.
- Reports count only current-version, complete, marketing-opted-in consent.
  Targeted campaign audience counts additionally require segmenting opt-in and
  a non-expired segment membership.
- Audience and completion metrics below the minimum cohort size (never less
  than ten) are suppressed as `null`. Responses omit users, wallets, Privy
  identities, segment rules, quest requirements, quiz answer digests, and
  verification proofs.
- Per-quest wallet-sharing consent does not authorize an address-export API in
  S7. That requires a separate reviewed delivery and retention design.

The credential trade-off, lifecycle rules, and privacy boundary are recorded
in
[`adr/0005-scoped-advertiser-admin-aggregates.md`](./adr/0005-scoped-advertiser-admin-aggregates.md).

## 14. S8 staged social retirement

The original S8 plan assumed `Post`, `Follow`, and `Like` routes were still
unused legacy surfaces. They now power the current EasyGo Home, Search,
Profile, Post Detail, Follow, and Notification screens, so S8 separates
retirement implementation from activation:

- `LEGACY_SOCIAL_MODE=active` is the default and preserves all reads/writes.
- `read_only` preserves GET/HEAD but returns `410` for social mutations.
- `retired` returns `410` for `/posts`, `/profiles`, `/follows`, and
  `/notifications` reads and writes.
- Missing or invalid mode values fall back to `active`; a typo cannot retire
  the current app.
- `GET /social/status` publishes read/write availability, optional sunset
  time, and the stable export path.
- `GET /me/social-export` remains authenticated and available in every mode.
  It contains only public profile fields, authored posts/replies, likes, and
  follow relations. It omits Privy/contact IDs, wallets, SIWE, consent,
  segments, quests, swaps, and Orange history.
- S8 performs no table deletion or data archival. Any retention/destructive
  migration requires separate approval and policy.

Production must remain `active` until a replacement client or explicit social
shutdown release is deployed, sunset/support copy is published, and the export
path is tested. The decision is recorded in
[`adr/0006-stage-legacy-social-retirement.md`](./adr/0006-stage-legacy-social-retirement.md).

## 15. S9 optional observability and process operations

S9 separates Express assembly from web process startup and formalizes the web
and segment worker as independently deployed processes. It does not change a
feature flag or apply a database migration.

- Every response receives a conservative request ID. HTTP logs record only the
  method, path without query, response status, duration, and that ID.
- `GET /health` is a dependency-free liveness probe. `GET /ready` performs a
  bounded database check and returns sanitized `503` responses on failure.
- Pino continues to write to stdout. Better Stack is an optional second
  destination only when both its source token and ingesting host are set.
- Sentry error reporting is optional. It disables default PII/local variables
  and removes user context, headers, cookies, bodies, query strings, and URL
  queries before transport. Trace sampling defaults to zero and is capped.
- `SIGINT`, `SIGTERM`, uncaught exceptions, and unhandled rejections initiate
  one bounded cleanup path. Web stops HTTP/Telegram then disconnects Prisma and
  flushes telemetry; worker aborts its loop before cleanup.
- `Procfile` declares `web: npm start` and
  `worker: npm run worker:segments`. The two Railway services share a release
  but scale and roll back independently.

Telemetry remains inactive until vendor/privacy approval and production secrets
are configured. Deployment setup, alert baselines, restart drills, and rollback
are documented in [`OPERATIONS.md`](./OPERATIONS.md). The decision and privacy
trade-offs are recorded in
[`adr/0007-optional-privacy-minimized-observability.md`](./adr/0007-optional-privacy-minimized-observability.md).
