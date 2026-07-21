# ADR-0002: Issue ENS subnames on mainnet and attach a Base address record

**Status:** Accepted
**Date:** 2026-07-21
**Deciders:** EasyGo backend maintainers

## Context

The Path C v2 roadmap originally described ENS, EFP, and SIWE as "all on
Base". EasyGo owns `coineasy.eth` and wants to issue
`<handle>.coineasy.eth` through JustaName while keeping the product wallet and
onchain activity on Base.

JustaName's current subname API only accepts Ethereum Mainnet (`1`) and
Sepolia (`11155111`) as issuance chain IDs. ENS supports a separate Base
address record using the ENSIP-11/19 coin type derived from Base chain ID
`8453`. The user must sign a short-lived JustaName SIWE challenge and the
server must protect the JustaName API key.

Official references:

- [JustaName add-subname API](https://docs.justaname.id/api/api-reference/subname/add)
- [JustaName challenge API](https://docs.justaname.id/api/api-reference/siwe/request-challenge)
- [ENSIP-19 multichain primary names](https://docs.ens.domains/ensip/19/)
- [ENS Base and mainnet configuration](https://docs.ens.domains/web/ensv2-readiness/)

## Decision

Issue `coineasy.eth` subnames through JustaName on Ethereum Mainnet chain ID
`1`. Each issued name stores two forward address records for the same
Base-verified EVM address:

- coin type `60` for Ethereum compatibility; and
- coin type `2147492101` (`0x80000000 + 8453`) for Base.

EasyGo obtains the user's Base address through the existing Base SIWE flow.
JustaName issuance then uses its own two-minute SIWE challenge because the
provider requires that exact message and signature. The backend stores only a
SHA-256 challenge hash and expiration, never the raw challenge or signature.

Issuance runs as a small state machine on `User`:
`NOT_REQUESTED → PENDING → ISSUED | FAILED`. An atomic transition to
`PENDING` prevents concurrent duplicate issuance. If the provider succeeded
but the local database update was interrupted, the retry reconciles the public
JustaName record and only accepts it when it resolves to the user's verified
address.

The JustaName API key remains server-only. All S4 routes return `404` while
`JUSTANAME_ENABLED` is false.

## Options Considered

### Option A: Send chain ID 8453 to the JustaName issuance API

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Provider compatibility | Unsupported |
| Base identity fit | Superficially direct |
| Operational risk | High |

**Pros:** Matches the original shorthand in the roadmap.

**Cons:** The provider rejects chain ID `8453`; no valid production path.

### Option B: Mainnet issuance with Ethereum and Base address records

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Provider compatibility | Supported |
| Base identity fit | Strong forward-resolution support |
| Operational risk | Low with state/reconciliation controls |

**Pros:** Uses the owned `.eth` namespace and supported JustaName contract
while making the Base address explicit under ENSIP-19.

**Cons:** ENS issuance is an Ethereum L1 control-plane operation, so the
architecture is not literally Base-only.

### Option C: Replace JustaName with a custom Base-native naming contract

| Dimension | Assessment |
|-----------|------------|
| Complexity | High |
| Provider compatibility | Not applicable |
| Base identity fit | Native |
| Operational risk | High |

**Pros:** Full Base-native ownership and custom policy.

**Cons:** Loses the current JustaName/CCIP-Read plan and introduces contract,
resolver, security-review, and operations work outside S4 scope.

## Trade-off Analysis

Option B is the only route that preserves the owned `coineasy.eth` identity,
uses the selected JustaName provider, and gives wallets an explicit Base
address record. It adds a chain distinction the app must explain: issuance and
resolution metadata live through ENS on mainnet, while the user's wallet
verification and product transactions remain on Base.

## Consequences

- Production `JUSTANAME_CHAIN_ID` is fixed to `1`.
- Base remains the application transaction chain and SIWE ownership source.
- Name readers should request the Base coin type instead of assuming coin type
  `60` is always the desired destination.
- Setting a Base primary/reverse name is a separate user-authorized operation
  and is not implied by forward subname issuance.
- A verified address cannot be replaced after a subname has been issued unless
  a future transfer/revocation flow is implemented.
- The policy and privacy documentation must identify JustaName as a processor
  receiving the wallet address and signed challenge.

## Action Items

1. [x] Add the default-off S4 challenge and issuance routes.
2. [x] Store issuance state, challenge hash, address, chain, and timestamps.
3. [x] Write both Ethereum and Base address records through the official SDK.
4. [ ] Configure `coineasy.eth` and generate a restricted server API key in
   the JustaName dashboard.
5. [ ] Add the mobile wallet signing UI after legal copy and provider setup are
   approved.
6. [ ] Evaluate Base reverse-primary-name setup as a separate future flow.
