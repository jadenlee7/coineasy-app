# EasyGo Weekly Onchain Boss — W0 Candidate

- **Status:** W0 candidate implemented locally; activation blocked
- **Runtime route:** Registered only when `WEEKLY_ONCHAIN_BOSS_W0_ENABLED=true`
- **API or wallet wiring:** None
- **Activation gate:** Practice Missions fun and safety test plus owner approvals must be recorded

## Concept

**BASE SAFETY RAID · WEEKLY ONCHAIN BOSS** combines the strongest Practice
Arcade interaction with a four-act Web3 safety story. It should feel like a
weekly raid, but the user wins by noticing evidence and choosing when to stop,
not by spending money or executing a transaction.

## ADR — W0 implementation boundary

- **Status:** Proposed for Build 113; runtime closed
- **Date:** 2026-09-03
- **Decision:** Implement the four-act W0 raid as an isolated local feature
  slice while keeping its single compile-time activation flag `false`.
- **Deciders still required for activation:** Product, Security,
  Privacy/Legal, and Moderation owners.

The candidate uses an immutable fixture, a React-free canonical state machine,
and an in-memory screen. It is separate from the three-mission Practice engine
so its four-act lifecycle cannot change Daily Run score, streak, XP, Orange, or
practice results. The authenticated Practice Arcade is its only proposed entry
point. Backgrounding or changing the account lease destroys the current raid.

Options considered:

| Option | Safety | Product value | Decision |
| --- | --- | --- | --- |
| W0 fixed offline fixture | Highest; no identity or network data | Tests the complete raid loop | Selected |
| W1 own-address read-only data | Adds privacy, provider, and lifecycle risk | More personal | Deferred; not authorized |
| Real quote or transaction ending | Signing, asset, and App Store risk | Not needed to teach the stop decision | Rejected |

Consequences:

- The complete UI and engine can be reviewed and tested without contacting a
  provider or creating persistent account data.
- A later one-line flag change is still insufficient on its own: the fun-test,
  owner approval, bundle scan, and physical-device QA receipts remain required.
- The candidate intentionally has no badge, reward, telemetry, weekly reset,
  remote content, or live Base activity.

## Four-act raid

1. **Ready check** — distinguish the expected account, Base chain `8453`, and
   public wallet address without requesting a signature.
2. **Receipt trail** — inspect status, network, recipient, and confirmations on
   a curated receipt.
3. **Scam ambush** — reject a message that impersonates the completed action or
   asks for secret information.
4. **Quote shield** — read expiry, price impact, fee, and minimum received, then
   choose `멈추고 다시 확인` as the final safety decision.

There is deliberately no Execute, Accept, Confirm, Swap, Sign, Send, Claim, or
Mint ending.

## Proposed rollout options

### W0 — Curated raid fixture

- Fixed Base receipt, message, and quote snapshots bundled with the app.
- No network, wallet provider, storage, or live/current-user account address;
  only a clearly truncated training address is bundled in the fixture.
- Best first implementation if Practice Missions pass the fun gate.
- Candidate implementation files are `data/weeklyOnchainBoss.mjs`,
  `utils/weeklyOnchainBossEngine.mjs`, and `screens/WeeklyOnchainBoss.js`.

### W1 — Own-address read-only raid

- Consider only after separate privacy, security, App Store, and implementation
  approval.
- Read public activity for the currently attested Base address without signing.
- Use a fixture fallback when the address has no suitable activity.
- Never store full addresses, receipts, or quote responses in analytics.

W1 is not authorized by this document.

## Safety and lifecycle requirements

- Backgrounding, logout, or account change invalidates the raid session.
- A wallet mismatch blocks own-address data and falls back to a fixture; it
  never asks the user to repair the mismatch with a signature.
- Signer, calldata, contract-write, broadcast, Squid execution, and Orange
  reward clients are absent from the route and release graph.
- A public transaction hash is treated as public; seed phrases, private keys,
  recovery codes, and authentication tokens are never requested or rendered.
- The only possible reward is a non-transferable local learning badge, subject
  to a later reward-policy approval. No reward exists in the current design.

## Activation gate

Runtime activation and a Build 113 release may occur only when all are true:

1. At least five beginner playtests meet the thresholds in
   `EASYGO_DAILY_RUN_PHASE2_PRACTICE_MISSIONS.md`.
2. The most replayed and best-understood mission interaction is selected.
3. Every tester understands that Practice Arcade produced no real transaction,
   signature, block, report, or quote.
4. Product, Security, Privacy/Legal, and Moderation owners approve the raid
   content and read-only data boundary.
5. A separate W0 activation/release approval explicitly authorizes the closed
   feature flag and Build 113 work. W1 remains a later, separately approved
   runtime-data phase.

## Suggested playtest decision

- If **Scam Shield Duel** wins replay intent, use its boss-health and defensive
  choice loop as the raid spine.
- If **Receipt Detective** wins comprehension, use direct evidence-field taps
  as the raid spine.
- If **Live Quote Boss** wins both, use timed condition-reading while keeping
  the countdown non-punitive and offline in W0.
- If no mission reaches 3.5/5 fun or 80% help-free completion, revise Phase 2
  instead of implementing the weekly raid.

## Activation action items

- [ ] Record the Build 112 founder smoke for all three Practice Missions.
- [ ] Record at least five beginner playtests and confirm every fun and safety
  threshold in `EASYGO_DAILY_RUN_PHASE2_PRACTICE_MISSIONS.md`.
- [ ] Select the strongest interaction and confirm that the W0 candidate still
  reflects the observed result.
- [ ] Record Product, Security, Privacy/Legal, and Moderation approval.
- [ ] Re-run mobile tests, the iOS App Store bundle scan, and physical-device
  lifecycle QA with the exact release commit.
- [ ] Enable `WEEKLY_ONCHAIN_BOSS_W0_ENABLED` only in a separate reviewed
  activation change before preparing Build 113.

## Current repository boundary

The W0 candidate now includes a screen, pure engine, fixed fixture, and a route
that is conditionally registered behind
`WEEKLY_ONCHAIN_BOSS_W0_ENABLED=false`. The Practice Arcade CTA uses the same
closed flag. The candidate adds no API call, wallet provider, persistent
storage, database model, migration, job, contract, deployment, or EAS build.

This change does not claim that the five-person beginner test or owner approval
gate has passed. It does not authorize changing the flag, merging the feature,
incrementing Build 113, submitting to TestFlight, enabling W1, or adding any
signature, transfer, Squid execution, live quote, or real-address lookup.
