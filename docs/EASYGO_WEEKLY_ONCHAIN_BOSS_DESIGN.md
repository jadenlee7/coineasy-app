# EasyGo Weekly Onchain Boss — Design Only

- **Status:** Proposed; not implemented
- **Runtime route:** None
- **API or wallet wiring:** None
- **Implementation gate:** Practice Missions fun and safety test must pass

## Concept

**BASE SAFETY RAID · WEEKLY ONCHAIN BOSS** combines the strongest Practice
Arcade interaction with a four-act Web3 safety story. It should feel like a
weekly raid, but the user wins by noticing evidence and choosing when to stop,
not by spending money or executing a transaction.

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
- No network, wallet provider, storage, or account address.
- Best first implementation if Practice Missions pass the fun gate.

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

## Implementation gate

Implementation may start only when all are true:

1. At least five beginner playtests meet the thresholds in
   `EASYGO_DAILY_RUN_PHASE2_PRACTICE_MISSIONS.md`.
2. The most replayed and best-understood mission interaction is selected.
3. Every tester understands that Practice Arcade produced no real transaction,
   signature, block, report, or quote.
4. Product, Security, Privacy/Legal, and Moderation owners approve the raid
   content and read-only data boundary.
5. A separate implementation request defines whether the first build is W0 or
   W1 and explicitly approves any runtime, API, wallet, persistence, or release
   work.

## Suggested playtest decision

- If **Scam Shield Duel** wins replay intent, use its boss-health and defensive
  choice loop as the raid spine.
- If **Receipt Detective** wins comprehension, use direct evidence-field taps
  as the raid spine.
- If **Live Quote Boss** wins both, use timed condition-reading while keeping
  the countdown non-punitive and offline in W0.
- If no mission reaches 3.5/5 fun or 80% help-free completion, revise Phase 2
  instead of implementing the weekly raid.

## Current repository boundary

This document does not authorize or add a screen, navigation route, API call,
feature flag, database model, migration, job, contract, deployment, or EAS
build. The phrase `Weekly Onchain Boss` must remain documentation-only until a
new implementation approval is recorded.
