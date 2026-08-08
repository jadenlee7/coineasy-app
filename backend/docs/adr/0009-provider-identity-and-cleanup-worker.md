# ADR-0009: Fence provider identity and isolate account-cleanup work

**Status:** Accepted for implementation; activation deferred
**Date:** 2026-08-08
**Deciders:** EasyGo backend and mobile maintainers

## Context

ADR-0008 introduced a durable account-deletion request keyed by an HMAC of
the Privy DID. That blocks stale sessions for the deleted DID, but Privy may
issue a new DID and a new embedded wallet when the same person signs in again.
The server can resolve the Apple OAuth subject from Privy's server-verified
linked accounts, but the current profile projection discards it.

The deletion table already contains state, lease, retry, and encrypted-DID
columns, but no process claims or advances provider work. Apple authorization
revocation ownership is also unresolved: EasyGo has no Apple access token,
refresh token, or authorization code, and Privy's user-deletion contract does
not state that deleting a Privy user revokes Sign in with Apple authorization.

Provider operations are irreversible and cannot share a process-level feature
gate with consent segmentation. They also cannot hold a database transaction
open across an external request.

References:

- [Apple: Revoke tokens](https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens)
- [Apple TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- [Privy: Delete a user](https://docs.privy.io/api-reference/users/delete)
- [Privy: Deleting users](https://docs.privy.io/user-management/users/managing-users/deleting-users)

## Decision

Store a permanent, domain-separated HMAC tombstone for each supported stable
provider identity captured from a server-fetched Privy user. The first
supported provider is Apple OAuth. Raw provider subjects and provider email
addresses are never stored. Deletion and auth sync acquire locks for the DID
and every provider-identity digest in deterministic order and recheck all
tombstones in the same transaction. A new Privy DID with the same tombstoned
Apple subject is therefore blocked before local user creation or rewards.

Run provider cleanup in a dedicated process with a separate compile-time brake
and runtime kill switch. A third, irreversible stable-identity enforcement
latch remains independent from both runtime kill switches: once deletion has
ever been exposed, rolling back new requests must not reopen tombstone bypass.
All three compile-time latches remain closed in this release, and the public
request gate depends on both safety latches.

Each worker claim uses `FOR UPDATE SKIP LOCKED`, a random lease token, an expiry,
and an incremented state version. All result writes compare the request ID,
lease token, state, and state version. External calls happen after the claim
transaction commits. A stale worker cannot advance a reclaimed row.

Attempts are counted per state and reset after a successful transition.
Retryable transport errors, timeouts, `429`, and `5xx` responses use bounded
full-jitter exponential backoff. Row corruption and non-retryable provider
responses go to `MANUAL_REVIEW`. Global credential/configuration failures stop
the cycle without converting every claimed row to manual review.

Privy success is `204`. Every `404` goes to manual review: a claim counter,
earlier timeout, or pre-call marker cannot prove that a previous request was
delivered and applied. The worker never polls Privy user lookup as
confirmation and never infers absence as automated success.

Apple work advances only with an explicit durable disposition:

- `NOT_APPLICABLE` for a server-verified snapshot with no Apple identity;
- `EASYGO_REVOKED` after EasyGo receives a successful Apple revoke response;
- `PRIVY_CONFIRMED` only after written confirmation that the approved Privy
  flow owns Apple revocation.

No current production adapter may infer one of these outcomes. The worker stays
dormant until the Apple mode, stable identity, recent-authentication, retention,
and disposable-account QA blockers are closed.

Worker logs contain only the internal request ID, stage, attempt number,
sanitized error code, and duration. They never contain a raw DID, provider
subject or digest, ciphertext, lease token, provider URL/body, or credential.
The authenticated full-data export may describe the active provider namespace,
context, key version, and creation time, but never exports the provider digest
or key fingerprint.

## Options Considered

### Option A: Delete Privy synchronously in the HTTP request

| Dimension | Assessment |
|-----------|------------|
| Implementation effort | Low |
| Crash recovery | Poor |
| Provider outage behavior | Poor |
| Request latency | Unbounded |

**Pros:** Small implementation and immediate provider call.

**Cons:** Cannot atomically combine local deletion and provider operations,
loses the response on timeout, and has no durable retry or fencing.

### Option B: Add cleanup to the segment worker

| Dimension | Assessment |
|-----------|------------|
| Process count | Low |
| Secret isolation | Poor |
| Failure isolation | Poor |
| Operational clarity | Poor |

**Pros:** Reuses an existing loop and Railway service.

**Cons:** Cleanup would depend on the segmentation gate and lifecycle, expose
provider credentials to an unrelated process, and couple privacy deletion to
analytics failures.

### Option C: Stable identity tombstones plus a dedicated leased worker

| Dimension | Assessment |
|-----------|------------|
| Re-creation protection | Strong for captured identities |
| Crash recovery | Strong |
| Secret/failure isolation | Strong |
| Complexity | Medium-high |

**Pros:** Closes the new-DID race, supports bounded recovery, and keeps every
irreversible step behind explicit gates.

**Cons:** Adds durable identity metadata, another process, migrations,
operational alerts, and a manual-review runbook.

## Trade-off Analysis

Option C adds the most machinery, but the machinery is the safety boundary.
The permanent identity digest limits deliberate re-registration, which is an
intentional default until Product and Legal approve a different retention
policy. The digest key requires the same backup and versioned-rotation controls
as the DID tombstone key.

The worker favors false negatives over false completion. Any Privy `404`,
an unknown Apple disposition, corrupted ciphertext, or lost fencing lease does
not become `COMPLETED` automatically.

## Consequences

- A deleted Apple identity cannot silently create a new EasyGo user through a
  replacement Privy DID once the stable-identity migration is deployed.
- Provider cleanup has its own process, kill switch, metrics, and secrets.
- The worker can be shipped and fully tested while dormant.
- Privy DELETE idempotency headers are not assumed; an ambiguous retry that
  returns `404` stops in `MANUAL_REVIEW` rather than claiming completion.
- The existing redacted-post database invariant prevents a concurrent write
  from committing sensitive content under a null author. Such a race can roll
  back the first local purge attempt, so mobile retains its requesting marker
  and staging activation QA must also prove the recovery retry.
- Embedded wallet and public blockchain history are not represented as erased.
- `MANUAL_REVIEW` needs an authenticated, audited operational runbook before
  activation.
- Account deletion remains unavailable until Apple revocation and recent
  reauthentication are genuinely implemented and tested.

## Action Items

1. [x] Add and migrate the provider-identity tombstone; Apple disposition
   remains an activation blocker.
2. [x] Block auth sync by both DID and stable Apple identity under ordered locks.
3. [x] Add the dormant dedicated leased worker and sanitized provider adapters.
4. [x] Add migration, race, lease-fencing, retry, and log-redaction tests.
5. [ ] Obtain written Apple-revocation ownership evidence or implement EasyGo
   token capture, client-secret generation, and revoke handling.
6. [ ] Add recent interactive reauthentication before destructive confirmation.
7. [ ] Approve retention/re-registration and manual-review procedures.
8. [ ] Run disposable staging deletion QA before opening any latch.
