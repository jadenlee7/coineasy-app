# ADR-0004: Verify quest completion on the server before awarding Orange

**Status:** Accepted
**Date:** 2026-07-21
**Deciders:** EasyGo backend maintainers

## Context

S6 introduces quiz and Base transaction quests. The existing mobile course
flow checks the answer in React Native and then calls a section allow-list
endpoint. That is sufficient for a Phase 1 demo but lets a modified client
claim a reward without submitting an answer. Transaction quests introduce
additional replay, ownership, finality, and RPC-failure risks.

The existing S2 schema already has `Quest`, `QuestCompletion`, and an
append-only `OrangeLedger`. S6 must use those tables without a new migration.
It must also preserve the privacy rule that wallet-address sharing is a
separate, timestamped per-quest decision; a transaction proof alone is not
consent.

Base's receipt API returns `null` until a transaction is mined and exposes the
sender, recipient, status, block, and logs after inclusion. Transaction input
and value come from the transaction object, while the block timestamp and
latest height are needed to enforce post-start execution and confirmations.

Official references:

- [Base transaction receipts](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_getTransactionReceipt)
- [Base transactions by hash](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_getTransactionByHash)
- [Base blocks by number](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_getBlockByNumber)
- [Base chain IDs](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId)

## Decision

Add strict version-1 requirement schemas for two quest types:

- `QUIZ` requirements contain a public question/options payload and a
  server-evaluated SHA-256 digest of the correct option scoped to the quest
  slug. API responses omit the digest. A successful proof stores only that the
  quiz verifier passed, not the submitted answer.
- `TRANSACTION` requirements are fixed to Base mainnet chain ID `8453` and may
  constrain the recipient, four-byte function selector, minimum native value,
  and one required event address/topic. At least one transaction-specific
  predicate is required.

Transaction quests require an explicit start before the wallet submits the
transaction. The verifier requires:

1. a current Base SIWE-verified address;
2. a mined, successful receipt;
3. receipt and transaction sender equal to that verified address;
4. the configured recipient/input/value/event predicates;
5. a block timestamp no earlier than the completion start; and
6. the configured minimum sealed-block confirmations.

Pending or under-confirmed proofs return a retryable conflict and do not erase
progress. Definitive mismatches mark the completion rejected. RPC failures do
not change completion state.

After external verification, one short database transaction atomically changes
the completion to `VERIFIED` and upserts one `QUEST_REWARD` ledger row keyed by
quest and user. An advisory transaction lock plus a JSON proof lookup prevents
one transaction hash from satisfying multiple quests without adding a proof
table in S6. Concurrent retries are idempotent.

`POST /quests/:id/start` records wallet-sharing consent only when the quest
explicitly requires it. The completion proof never stores a wallet address.
`GET /quests` exposes active quest content and the current user's status, but
not correct-answer digests or another user's completion.

All routes return `404` while `QUESTS_ENABLED=false`. When S6 is enabled, the
legacy course-quiz reward endpoint returns `410` so it cannot bypass the new
server verifier.

## Options Considered

### Option A: Trust client completion and only deduplicate rewards

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Abuse resistance | Poor |
| RPC cost | None |
| Auditability | Low |

**Pros:** Smallest change and lowest latency.

**Cons:** A modified client can claim quiz and transaction rewards without
performing the required action.

### Option B: Synchronously verify each proof and atomically award

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Abuse resistance | Strong for defined predicates |
| RPC cost | One bounded verification per submission |
| Auditability | Strong, privacy-minimized |

**Pros:** Immediate user feedback, no new queue/table, and clear idempotency.

**Cons:** Completion latency and availability depend on Base RPC. Clients must
retry pending or under-confirmed transactions.

### Option C: Queue every proof for an asynchronous verifier worker

| Dimension | Assessment |
|-----------|------------|
| Complexity | High |
| Abuse resistance | Strong |
| RPC cost | Controllable in batches |
| Auditability | Strong |

**Pros:** Better throughput and isolation from RPC latency.

**Cons:** Requires queue/outbox state and a status-polling UX not present in
S6. It exceeds the no-migration constraint.

## Trade-off Analysis

Option B gives S6 meaningful server authority while keeping the current data
model and a responsive mobile flow. It accepts bounded RPC dependency in
exchange for avoiding speculative queue infrastructure. The verifier and
requirement schemas are isolated so an asynchronous implementation can replace
the orchestration later without changing quest definitions.

## Consequences

- Quiz answer digests are operational verifier data and must never appear in
  list/detail responses or logs.
- Transaction quests cannot be completed with activity performed before the
  user started that quest.
- Smart accounts are supported when the verified smart-account address is the
  transaction sender. Sponsored/batched flows whose outer sender differs need
  a future account-abstraction-aware proof type.
- Wallet-sharing consent remains independent from proof verification and can be
  audited through its boolean and timestamp.
- Operators must keep every quest `DRAFT` until its requirements and reward are
  reviewed; local seed data never promotes a quest to `ACTIVE`.
- A future high-volume release may move transaction proofs to a queue/outbox
  and add a dedicated globally unique proof-reference column.

## Action Items

1. [x] Add strict version-1 quiz and Base-transaction requirement schemas.
2. [x] Add gated list/start/complete endpoints with sanitized responses.
3. [x] Make completion and Orange reward issuance atomic and idempotent.
4. [x] Add dormant course-quiz and transaction examples to the local seed.
5. [ ] Review and activate production quests only after content, reward, RPC,
   and wallet-sharing copy approval.
6. [ ] Add account-abstraction event/user-operation proofs if sponsored quest
   transactions do not expose the verified wallet as the outer sender.
