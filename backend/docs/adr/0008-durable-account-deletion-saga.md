# ADR-0008: Use a durable, fail-closed account-deletion saga

**Status:** Accepted for implementation; activation deferred
**Date:** 2026-08-02
**Deciders:** EasyGo backend and mobile maintainers

## Context

EasyGo creates a local account from a verified Privy session and automatically
repeats `/auth/sync` after an authenticated app launch. The current dormant
`DELETE /me/data` implementation cannot be enabled safely:

- it deletes every reply below a deleted user's root post, including replies
  written by other people;
- `Post.authorId` cascades from `User`, so deleting an author destroys all of
  their thread nodes;
- `/auth/sync` can immediately recreate the local `User` while the Privy
  session remains valid;
- Privy documents that a later login can receive a new DID, so a DID-only
  tombstone cannot identify a fresh account for the same Apple identity; and
- a single HTTP request cannot atomically delete PostgreSQL data, revoke Sign
  in with Apple authorization, and delete the Privy user.

Apple requires apps that create accounts to let users initiate deletion in the
app. Apps using Sign in with Apple should also revoke the user's tokens. Apple
documents a manual revocation fallback when no refresh token, access token, or
authorization code is available, but the user's data still has to be deleted.
EasyGo currently delegates Apple OAuth to Privy and does not receive an Apple
refresh token. Privy documents user deletion as destructive and explains that
embedded wallets are disassociated and archived rather than erased. Deleting a
Privy user may therefore make its wallet difficult or impossible to recover.

References:

- [Apple: Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple TN3194: Account deletion and token revocation](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- [Privy: Deleting users](https://docs.privy.io/user-management/users/managing-users/deleting-users)

## Decision

Use an asynchronous deletion saga anchored by a durable tombstone that is not
related to the deletable `User` row.

The foundation tombstone uses an HMAC-SHA-256 digest of the Privy DID as its
lookup key. It blocks that DID and its stale sessions. It does not yet block a
new Privy DID issued for the same Apple account; activation therefore also
requires an approved stable-provider-identity capture and lookup design. The
raw DID is retained only as an AES-256-GCM ciphertext while provider cleanup is
pending. Neither value may be logged. Completion removes the ciphertext but
preserves the digest and minimal timestamps.

The state machine is monotonic:

```text
REQUESTED
  -> LOCAL_PURGED
  -> APPLE_REVOKED
  -> PRIVY_DELETED
  -> COMPLETED

Any non-retryable provider failure -> MANUAL_REVIEW
```

The first implementation unit deliberately stops at `LOCAL_PURGED`. A
compile-time release brake and deployment preflight reject every attempt to
enable the public request or provider-cleanup flags. They remain locked until
the worker, stable Apple identity guard, mobile marker, wallet warnings,
retention policy, and recovery behavior have all passed staging review.

Local deletion redacts the deleted user's posts in place, changes the author
foreign key to `ON DELETE SET NULL`, and then deletes the `User`. This retains
thread topology and other users' replies while removing the deleted user's
body, media, and author relationship. The same redaction behavior applies to
ordinary post deletion.

Both `/auth/sync` and deletion acquire the same PostgreSQL advisory transaction
lock derived from the subject digest and recheck the tombstone inside the
transaction. A tombstone always returns `410 account_deletion_in_progress` and
prevents `User.upsert` or a new welcome reward.

Every tombstone also stores a keyed fingerprint for its HMAC-key version.
The database pins that version to a single fingerprint with an atomic
insert-if-absent registry row, and guarded requests compare the configured key
before subject lookup. An accidental secret replacement therefore returns
`503` instead of silently making old tombstones invisible, without globally
serializing unrelated user syncs.

When the later release brake is removed, account deletion will be accepted with
an idempotent client request ID and return `202 Accepted`. A successful response
means only that the local purge is
durably recorded; it must not claim that Apple, Privy, the embedded wallet, or
public blockchain history has been deleted.

The mobile app stores a separate versioned marker in SecureStore under a key
derived from SHA-256 of the current Privy DID. The raw DID is not stored in the
key or marker. Marker states are monotonic (`requesting` to `accepted`) and are
loaded before `/auth/sync` is allowed to run. A corrupt marker, SecureStore
failure, or in-flight marker write blocks both authenticated fallback and the
main navigator. Other Privy accounts use different keys and remain available.

The marker write is the first side effect of a deletion request. A write
failure means the destructive HTTP request is never sent. Network failures,
5xx responses, malformed success responses, and account changes preserve the
marker and bearer session so the dedicated pending screen can retry with the
same client request ID. Logout happens automatically only after a confirmed
`202` or deletion tombstone. Destructive status and request calls bind the
Bearer token provider to the expected Privy DID and reject before `fetch` if
that owner changes while the token is being resolved. The client also requires
the access-token `sub` claim to equal that DID; the backend remains responsible
for cryptographic token verification and rejects the destructive request unless
the verified token DID exactly matches the client's confirmed expected DID.

`GET /me/account-deletion` always reports an existing request even if the
activation brake is reapplied; `available` controls only creation of a new
request. The settings UI enters its wallet warning and typed `DELETE`
confirmation only after that endpoint explicitly returns `available: true`.

## Options Considered

### Option A: Keep the current cascading hard delete

| Dimension | Assessment |
|-----------|------------|
| Implementation effort | Low |
| Other users' content | Destructive |
| External retry safety | None |
| Re-creation prevention | None |

**Pros:** Small amount of code and an immediate HTTP response.

**Cons:** Deletes content the account owner does not own, loses recovery state
on partial provider failures, and allows the account to be recreated.

### Option B: Soft-delete the `User` row

| Dimension | Assessment |
|-----------|------------|
| Thread preservation | Good |
| Personal-data erasure | Weak |
| Re-creation prevention | Medium |
| Provider retry safety | Medium |

**Pros:** Keeps relationships intact and makes retries easy.

**Cons:** Retains the main identity record and most associated personal data,
so it is not the promised account deletion.

### Option C: Delete local identity behind a durable tombstone saga

| Dimension | Assessment |
|-----------|------------|
| Thread preservation | Good after redaction |
| Personal-data erasure | Strong and explicit |
| Re-creation prevention | Strong after stable provider identity guard |
| Provider retry safety | Strong |
| Complexity | High |

**Pros:** Separates irreversible local erasure from retryable provider cleanup,
preserves other people's content, and gives every stale token a fail-closed
answer.

**Cons:** Requires schema, worker, key-management, mobile session-gating, and
operational recovery changes.

## Trade-off Analysis

Option C adds operational state and two encryption secrets, but it is the only
option that preserves content ownership and remains correct when Apple or Privy
is unavailable. A permanent HMAC tombstone is intentional minimal retention:
without it, the same deleted Privy DID could silently reappear. The stored key
fingerprint makes unplanned replacement fail closed. The hash key must still be
backed up separately from normal database backups and must not be rotated
without a versioned dual-read migration.

Redacted thread nodes remain as non-personal structural placeholders. Public
on-chain transactions also remain immutable. Product and legal copy must make
both facts clear before activation.

## Consequences

- `ACCOUNT_DELETION_ENABLED` remains `false` in Railway and all EAS builds.
- A DID tombstone blocks stale sessions only; a stable Apple identity guard is
  a release blocker before Privy deletion can be activated.
- Staging and production deploy preflight requires both deletion keys even
  while the request gate is off, so disabling the feature can never disable
  tombstone enforcement for subjects deleted earlier.
- Runtime auth sync independently requires the HMAC key in production and
  staging and returns a mobile-blocking `503` if key or guard storage is
  unavailable; startup does not rely on a manually run preflight.
- Build 101 stays an internal privacy-center QA build and is not an App Store
  review candidate.
- The mobile marker, owner-bound destructive authentication, session gate,
  pending screen, wallet acknowledgement, typed confirmation, and targeted
  cache purge are implemented but remain unreachable for new requests while
  the server capability is off.
- Posts gain nullable authors and an explicit deletion timestamp; clients must
  tolerate `author: null`.
- Provider cleanup can be retried without restoring a deleted `User`.
- Backups and restore drills must replay tombstones created after the restored
  snapshot before traffic is reopened.
- Independent Telegram/AMA identifiers, observability retention, and encrypted
  backups require approved deletion/retention rules before the UI can promise
  full EasyGo account deletion.
- A Privy user deletion must be treated as irreversible from the user's point
  of view even though Privy archives the embedded wallet internally.

## Implementation Overview

1. Add the tombstone state machine, nullable/redactable posts, constraints, and
   migration tests.
2. Add subject hashing, encrypted provider identifiers, idempotent local purge,
   the shared sync/deletion lock, and HMAC-key fingerprint enforcement.
3. Make every post consumer tolerate a null author and preserve replies during
   ordinary post deletion.
4. Add provider cleanup workers with bounded retry and lease semantics.
5. Add a stable Apple identity tombstone before Privy can issue a replacement
   DID, or document and implement Apple's approved manual fallback.
6. Add a mobile session gate and durable local deletion marker before exposing
   the two-step destructive UI.
7. Validate Apple revocation and Privy deletion on disposable staging accounts.
8. Complete retention/legal review, then enable the server capability for a
   new internal-only build before considering an App Store candidate.

## Action Items

1. [x] Implement and test the additive schema and local tombstone foundation
   on the isolated branch; production deployment remains deferred.
2. [x] Prevent `/auth/sync` from recreating a tombstoned Privy DID.
3. [ ] Add provider worker leases, retry/backoff, and redacted diagnostics.
4. [ ] Obtain written confirmation of Apple-token revocation ownership or add
   EasyGo's own Apple token-exchange/revocation flow.
5. [ ] Capture and tombstone a stable Apple subject so a new Privy DID cannot
   recreate the deleted account.
6. [ ] Approve wallet, blockchain, backup, Telegram/AMA, and telemetry copy and
   retention behavior.
7. [x] Add the mobile deletion marker, session gate, owner-bound request,
   two-step warning/confirmation UI, pending recovery screen, and targeted
   cache purge.
8. [ ] Add recent reauthentication and stable Apple-subject protection.
9. [ ] Run destructive QA only with a disposable staging account.
