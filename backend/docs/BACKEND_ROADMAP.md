# Backend Roadmap — Path C v2

Status: Plan (PR-S0)
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
                     │  - Base RPC poller                   │
                     │  - EFP API poller                    │
                     │  - NFT/token indexer (provider TBD)  │
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
| S1    | SIWE verification middleware                           | `SIWE_AUTH_ENABLED`  | `+verifiedAddress, +siweChainId` on User | low |
| S2    | Data model expansion (consent, quests, segments, ads)  | —                    | additive (8 new tables) | low |
| S3    | Consent + privacy routes (`/me/consent`, `/me/data`)   | —                    | none (uses S2 tables) | low |
| S4    | JustaName subname issuance                             | `JUSTANAME_ENABLED`  | `+subname` on User | low |
| S5    | Base indexer + segment worker (separate process)       | `SEGMENTS_ENABLED`   | none         | medium |
| S6    | Quest system (quiz + tx-execute)                       | `QUESTS_ENABLED`     | none         | medium |
| S7    | Advertiser admin (`/admin/*`)                          | —                    | none (uses S2 tables) | medium |
| S8    | Legacy social routes deprecated (`410 Gone`)           | —                    | none (archive only) | medium |
| S9    | Observability (Sentry, Logtail, Procfile worker split) | —                    | none         | low |

Phase 2 chain activation (`PHASE.EASYCHAIN_ENABLED`) remains gated by the
existing criteria in `EASYGO_BUILD_PLAN.md §4.1` and is **out of scope** for
this roadmap. Path C v2 is intentionally Base-only.

---

## 4. Decisions locked in

- **Chain**: Base (chainId 8453). No Aurora.
- **Identity**: ENS + EFP + SIWE, all on Base. `coineasy.eth` is owned.
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
   That per-quest opt-in is recorded on `QuestCompletion.verifyProof`.
4. **User control panel exists from day one.** `/me/data` (read),
   `/me/consent` (toggle), `/me/data` DELETE (forget) must be live before
   any advertiser campaign ships.
5. **Logs and dumps redact PII.** pino redact list must include email,
   privyId, walletAddress when log level is `info` or below.

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
version and forces a re-consent prompt on next app launch. Audit log of
version transitions lives in a `UserConsentAudit` table (added in S3).
