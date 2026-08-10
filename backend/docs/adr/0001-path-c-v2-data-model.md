# ADR 0001: Normalize the Path C v2 data model

Status: Accepted
Date: 2026-07-21
Decision owners: EasyGo backend maintainers

## Context

Path C v2 adds consent, quests, behavioral segments, and advertiser campaigns
to the existing EasyGo Postgres database. The schema must remain additive,
keep every new runtime feature disabled until its later roadmap stage, and
enforce the privacy rules in `BACKEND_ROADMAP.md` at the data boundary.

The important constraints are:

- behavioral segmenting is opt-in and the default must be `false`;
- advertisers receive aggregate results, not per-user evidence;
- sharing a wallet address is a separate decision for each quest;
- consent history must exist before the S3 privacy endpoints are activated;
- completed quests and campaign attribution must remain auditable; and
- S2 must add exactly eight tables without changing production behavior.

## Decision

Add eight normalized Prisma models:

1. `UserConsent` stores the current per-user consent state.
2. `UserConsentAudit` stores immutable consent snapshots.
3. `Quest` describes a quiz or on-chain transaction objective.
4. `QuestCompletion` stores one user's state for one quest.
5. `Segment` stores a versioned, operator-defined matching rule.
6. `UserSegment` stores only membership metadata, never raw activity evidence.
7. `Advertiser` represents an aggregate-only campaign owner.
8. `Campaign` connects an advertiser, an optional target segment, and quests.

`UserConsent.segmentingOptIn` and marketing consent default to `false`.
`QuestCompletion.walletSharingOptIn` also defaults to `false` and is paired
with a consent timestamp. `verifyProof` may hold the minimum proof needed by a
quest verifier, but it is not used as the sole record of wallet-sharing
consent.

Campaigns target at most one `Segment` in this first model. A segment rule may
already express multiple predicates, so a campaign-to-segment join table would
add complexity without enabling a current roadmap requirement.

Mutable business records use archive-style status enums. Foreign keys from
campaigns to advertisers/segments and from completions to quests use
`Restrict`, preserving attribution. User-owned records cascade when a user
invokes the future S3 forget endpoint.

No S2 feature flag is enabled and no S2 route is introduced by this decision.

## Options considered

### Store Path C state in JSON columns on `User`

This minimizes table count, but makes consent auditing, uniqueness, retention,
and aggregate reporting difficult to enforce. It also encourages raw on-chain
evidence to accumulate in a user profile document.

### Fully normalize every targeting predicate and proof type

This gives the strongest relational typing, but it commits the database to
indexer and quest-verifier shapes that are intentionally deferred to S5 and
S6. It would create several speculative tables and make the additive rollout
larger.

### Normalize lifecycle records and keep evolving rules/proofs as JSON

This is the selected option. Identity, consent, membership, sponsorship, and
completion lifecycles remain relational. Versioned segment rules and
quest-specific proof payloads stay flexible until their workers and verifiers
are implemented.

## Tradeoff

The selected design gives strong relational ownership, opt-in defaults, and
auditable state transitions while allowing verifier and targeting formats to
evolve. The tradeoff is that JSON rule/proof payloads require application-level
validation in S5/S6 and cannot be queried as safely as dedicated columns.

## Consequences

- S3 can implement consent read/update/delete without another schema change.
- S5 must skip users with no consent row or `segmentingOptIn = false`.
- S5 must store only membership metadata in `UserSegment`; raw wallet event
  data belongs in the source/indexer system, not this table.
- S6 must validate `requirements` and `verifyProof` by quest type and must not
  persist a wallet address unless `walletSharingOptIn` is explicitly true.
- S7 can calculate advertiser metrics by joining campaigns, quests, and
  completions, but must expose only grouped counts.
- Future multi-segment campaign targeting may require an additive
  `CampaignSegment` join table.
- Deleting an advertiser, active segment, campaign, or quest with dependent
  history is intentionally blocked; operators archive it instead.

## Action items

- Add and statically test the eight Prisma models in S2.
- Generate and review the additive migration against an approved development
  database before deployment.
- Implement consent mutations and audit-row creation together in one S3
  transaction.
- Add schema validation for segment rules in S5 and quest proofs in S6.
- Add aggregate-only authorization tests before the first S7 campaign is
  activated.
