# ADR-0006: Stage social API retirement without breaking the current app

**Status:** Accepted
**Date:** 2026-07-21
**Deciders:** EasyGo backend maintainers

## Context

The S8 roadmap says legacy social routes should return `410 Gone` and link to a
self-service exporter. Since that roadmap was drafted, the mobile migration
finished: `/posts`, `/profiles`, `/follows`, and `/notifications` are no longer
Orbis compatibility routes. They are the EasyGo Postgres social API used by the
current Home, Search, Profile, Post Detail, Follow, and Notification screens.

Returning `410` immediately would turn a roadmap checkbox into a production
outage. Doing nothing would leave no explicit retirement mechanism or export
path if EasyGo later removes the social loop as part of the Path C pivot.

The existing `/me/data` export contains social rows, but also contains identity,
wallet, consent, reward, and quest data. A social-retirement response should
point to a purpose-specific export that remains available after the social
surface is gone.

## Decision

Introduce `LEGACY_SOCIAL_MODE` with three explicit states:

- `active` (default): all existing social reads and writes continue unchanged;
- `read_only`: GET/HEAD requests continue, while social mutations return `410`;
- `retired`: every legacy social request returns `410`.

The gate covers `/posts`, `/profiles`, `/follows`, and `/notifications`, but not
core auth, privacy, rewards, quests, or `/me` routes. Invalid or missing mode
configuration falls back to `active` so a typo cannot retire the app.

Every `410` response includes machine-readable mode, optional sunset time, and
the authenticated `GET /me/social-export` path. A public `GET /social/status`
endpoint lets clients discover read/write availability before a transition.

Add a purpose-specific social export containing the authenticated user's public
profile fields, authored posts/replies, likes, following, and followers. It
omits Privy identifiers, contact identifiers, wallet addresses, SIWE state,
consent, segments, quests, swaps, and Orange history. The export route is
outside the retirement gate and uses `no-store` plus an attachment filename.

No production mode transition is performed in S8. Moving to `read_only` or
`retired` requires client release evidence, a published sunset, support copy,
and an export drill.

## Options Considered

### Option A: Return `410` immediately

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Roadmap literalism | High |
| Current app availability | Unacceptable |
| Reversibility | Requires deployment rollback |

**Pros:** Small change and completes the literal roadmap wording.

**Cons:** Breaks every major social screen without a replacement client or
advance notice.

### Option B: Keep the social API indefinitely

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Current app availability | High |
| Retirement readiness | None |
| Roadmap alignment | Poor |

**Pros:** No user-facing behavior change.

**Cons:** No controlled write freeze, no discoverable status, and no focused
export path for a later pivot.

### Option C: Add active, read-only, and retired modes

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Current app availability | High by default |
| Retirement readiness | Strong |
| Reversibility | One environment change |

**Pros:** Separates implementation from activation, supports a write freeze,
and gives clients a stable export/status contract.

**Cons:** Operations must manage the transition and keep sunset communication
consistent with configuration.

## Trade-off Analysis

Option C reconciles the roadmap with the actual dependency graph. It adds a
small permanent compatibility layer, but makes retirement observable,
reversible, and testable. Defaulting invalid configuration to `active` favors
availability because retirement is an operator action, not a safety fail-close
condition.

## Consequences

- S8 code can ship without changing the current mobile experience.
- A read-only window can stop new social data before final retirement.
- Export remains available even when every social route returns `410`.
- Public profile/search/feed data is unavailable in `retired` mode; only an
  authenticated user can export their own social data.
- The database tables are not deleted or archived in S8. Destructive retention
  work requires a separate approved migration and policy.
- `LEGACY_SOCIAL_SUNSET_AT` is informational; deployment and client rollout
  controls remain external operational steps.

## Action Items

1. [x] Add the three-state social gate with `active` as the safe default.
2. [x] Add public social capability metadata and machine-readable `410` bodies.
3. [x] Add a privacy-minimized authenticated social export.
4. [x] Add mode, route, and export privacy tests.
5. [ ] Publish a sunset and ship client handling before selecting `read_only`.
6. [ ] Verify export/support readiness before selecting `retired`.
7. [ ] Decide retention and archival policy before deleting any social table.
