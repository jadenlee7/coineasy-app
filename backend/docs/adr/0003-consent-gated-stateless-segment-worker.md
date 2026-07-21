# ADR-0003: Evaluate consent-gated segments without storing raw wallet events

**Status:** Accepted
**Date:** 2026-07-21
**Deciders:** EasyGo backend maintainers

## Context

S5 needs to derive useful audience segments from Base activity, token balances,
EasyGo swaps, and EFP social-graph counts. A segment may combine predicates such
as holding at least 100 USDC on Base and having recent Base activity.

The binding privacy constraints are stricter than the indexing requirement:
segmenting is opt-in, stale policy consent must behave as an opt-out, raw wallet
events must not be copied into `UserSegment`, and a consent revocation must stop
exposure immediately. S5 also has no database migration budget beyond the
already-added `Segment` and `UserSegment` tables.

Base JSON-RPC can read balances and transaction counts, but it is not an
address-history index. Scanning every Base block for every EasyGo wallet would
be expensive and operationally fragile. EFP already exposes an official public
API backed by its own open indexer. Etherscan V2 exposes Base address and token
history with timestamps, but requires a server API key and sends the opted-in
wallet address to another processor.

Official references:

- [Base JSON-RPC overview](https://docs.base.org/base-chain/api-reference/rpc-overview)
- [Base `eth_getLogs` guidance](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_getLogs)
- [EFP infrastructure and public API](https://docs.efp.app/production/infra/)
- [Etherscan Base transaction history](https://docs.etherscan.io/api-reference/endpoint/txlist)
- [Etherscan Base ERC-20 transfers](https://docs.etherscan.io/api-reference/endpoint/tokentx)

## Decision

Run S5 as a separate, interval-driven Node process. It only selects users who
have a Base-verified address and current-version terms, privacy, and segmenting
consent. The worker validates every active segment against rule schema version
1 before evaluating it.

Use a hybrid set of read-only sources:

- Base JSON-RPC through viem for native balance, ERC-20 balance, and account
  transaction count;
- Etherscan V2 with chain ID `8453` for bounded recent normal-transaction and
  ERC-20-transfer history;
- EFP's official public API for follower/following counts; and
- EasyGo Postgres for the existing Base `SwapLog` history.

Source responses and derived metrics live only in worker memory. The database
stores the resulting `UserSegment` membership, rule version, match time, and a
short expiry. It stores no transaction hashes, token-event payloads, EFP
account lists, balances, or rule evidence.

Evaluation has three outcomes: match, no match, and unknown. A source failure
is unknown and never creates a membership. It also does not immediately erase
a still-valid prior match; that membership expires automatically unless a
later successful run refreshes it. A successful no-match removes only an
`INDEXER` assignment and never overwrites an operator-created `MANUAL`
assignment.

The read-only `/segments` endpoint returns only the authenticated user's active
membership names and timestamps, never the rule JSON or another user's data.
It rechecks current consent on every request. Revoking segmenting consent also
deletes indexer-created memberships in the same database transaction.

All S5 runtime surfaces remain invisible or dormant while
`SEGMENTS_ENABLED=false`.

## Options Considered

### Option A: Scan Base blocks and logs into new local activity tables

| Dimension | Assessment |
|-----------|------------|
| Complexity | High |
| Privacy surface | High |
| Historical coverage | Strong after backfill |
| S5 migration fit | Poor |

**Pros:** Full control over indexing, retention, and reprocessing.

**Cons:** Requires checkpoint and raw-event tables, backfills, reorg handling,
and substantial storage. It conflicts with S5's no-migration and data-minimizing
constraints.

### Option B: Compute metrics from managed APIs and store only membership

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Privacy surface | Medium, disclosed processors |
| Historical coverage | Good within provider limits |
| S5 migration fit | Strong |

**Pros:** Supports useful v1 rules without raw-event retention or block-scan
infrastructure. Failures can be isolated and retried.

**Cons:** Adds Etherscan and EFP availability, rate-limit, and privacy-policy
dependencies. Recent history is bounded by provider pagination.

### Option C: Segment only from EasyGo's existing `SwapLog`

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Privacy surface | Low |
| Historical coverage | EasyGo-only |
| Product value | Limited |

**Pros:** No new processor or chain reads.

**Cons:** Cannot identify Base holders, broader Base activity, or EFP users and
does not meet the S5 product goal.

## Trade-off Analysis

Option B meets the v1 targeting requirement with the smallest retained data
surface. It trades provider independence for a much safer initial privacy and
operations footprint. Source adapters and versioned rules keep a later move to
a self-hosted Base/EFP indexer possible without changing membership consumers.

## Consequences

- Etherscan and EFP must be named in the approved privacy/processor inventory
  before S5 activation.
- `ETHERSCAN_API_KEY` remains server-only and is required only by rules that use
  time-windowed Base activity.
- Membership readers must enforce current consent even if an expired or stale
  row has not yet been cleaned up.
- Provider truncation means v1 activity predicates are minimum thresholds, not
  exact or maximum-count predicates.
- The worker should run as a single Railway worker service. Database writes are
  idempotent, so an accidental duplicate worker does not duplicate membership.
- A future high-volume stage can replace Etherscan with a self-hosted indexer
  behind the same source interface and add a dedicated checkpoint model in an
  additive migration.

## Action Items

1. [x] Add strict version-1 segment-rule validation and deterministic evaluator
   tests.
2. [x] Add Base RPC, Etherscan V2, EFP, and local swap source adapters.
3. [x] Add the default-off worker command and read-only `/segments` endpoint.
4. [x] Delete indexer memberships atomically when consent is revoked.
5. [ ] Approve the privacy/processor copy and provision a restricted Etherscan
   key before enabling S5.
6. [ ] Replace the managed history adapter with a self-hosted indexer if volume
   or provider limits justify the additional infrastructure.
