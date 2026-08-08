# ADR-0010: Require challenge-bound Apple reauthentication for account deletion

**Status:** Accepted for dormant implementation; activation deferred
**Date:** 2026-08-08
**Deciders:** EasyGo backend and mobile maintainers

## Context

ADR-0008 requires recent interactive authentication before a destructive
account-deletion request, and ADR-0009 requires the result to agree with the
stable Apple identity already bound to the current EasyGo account. A valid
Privy bearer session proves who authenticated that session; it does not prove
that the same person interacted with Apple immediately before deletion. Client
timestamps and an already-issued access token are therefore insufficient.

Privy's Expo login flow is also not an appropriate reauthentication primitive.
It rejects a new login while the user is already authenticated, and its public
Apple callback does not expose the identity token needed for a
server-challenge check. A linking flow changes account linkage and is not a
fresh-authentication contract.

Expo's native Apple API can request an interactive credential with caller
supplied `nonce` and `state`. The returned Apple identity token can be verified
by the backend against Apple's signing keys, issuer, audience, expiry, and the
server challenge. Apple documents that the server should verify the signed
identity token and challenge values rather than trusting client assertions.

References:

- [Apple: Authenticating users with Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple)
- [Apple: Verifying a user](https://developer.apple.com/documentation/signinwithapple/verifying-a-user)
- [Apple: OpenID request nonce](https://developer.apple.com/documentation/authenticationservices/asauthorizationopenidrequest/nonce)
- [Apple TN3194: Account deletion and token revocation](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)

The current unit is a dormant safety foundation. It does not enable deletion,
prove that Apple-token revocation is owned by EasyGo, or make Build 101 an
account-deletion release candidate.

## Decision

Use a two-step, server-issued challenge around Expo's native
`AppleAuthentication.signInAsync` and require the verified result to be
consumed atomically with a new deletion request.

1. The authenticated client calls
   `POST /me/account-deletion/reauth/challenge` with the existing
   `clientRequestId` and expected current Privy DID. The backend binds a
   cryptographically random nonce and state to the authenticated DID subject
   digest, request ID, Apple provider, and five-minute database-clock expiry.
   Issuance fails unless that DID already owns an immutable local
   `UserStableProviderIdentity` row in the Apple namespace.
   Only keyed or one-way representations of identity and challenge values are
   stored.
2. The iOS client invokes native `AppleAuthentication.signInAsync` with the
   exact server nonce and state. This is a second proof; it neither replaces
   the Privy session nor logs the user into a different EasyGo account.
3. The client calls `POST /me/account-deletion/reauth/verify` with the challenge
   ID, returned Apple identity token, nonce, and state. The backend verifies the
   RS256 JWT with Apple's current JWKS and enforces the Apple issuer, native app
   audience `com.coineasy.coineasysocial`, expiry/issued-at bounds, nonce, and
   challenge state. It then derives the domain-separated provider identity
   digest from the signed Apple `sub` and compares it to the immutable Apple
   mapping loaded from EasyGo's database, not a mutable Privy linked-account
   response. The authenticated session DID,
   expected DID, challenge subject, and client request ID must all agree.
4. Successful verification returns an opaque `reauthProof`. The proof is bound
   to its challenge and request, has a short lifetime, and may be used once.
   The final account-deletion request supplies `challengeId` and `reauthProof`.
   The backend consumes the verified challenge in the same PostgreSQL
   transaction as creation of the deletion tombstone and local purge. A failed
   purge rolls back consumption, preserving a safe retry with the same request
   ID; a committed request cannot replay the proof for another deletion.

Multiple client-request-bound challenges may coexist. Merely possessing a
bearer session and issuing another challenge must not invalidate a proof that
already passed the native Apple prompt. Each challenge is independently bound
and expires after five minutes; rate limiting is required before activation to
bound issuance and Apple JWKS load. Expired unconsumed rows are pruned
opportunistically. Consumed rows currently remain referenced by the durable
tombstone through a restrictive foreign key; activation requires an explicit
Legal/security decision on that audit retention model (or a replacement model)
rather than claiming bounded pruning.

Challenge subject hashes pin the same HMAC key version and fingerprint registry
used by deletion tombstones, so an accidental secret replacement fails closed.
A committed tombstone retains only the internal challenge ID as its one-time
authorization audit binding.

Security-sensitive expiry and consumption decisions use PostgreSQL's clock,
and every challenge timestamp is stored as `TIMESTAMPTZ`. A database trigger
makes bindings and expiry immutable and permits only
`ISSUED -> ATTESTED -> CONSUMED` transitions.
JWT verification and Apple JWKS retrieval fail closed with bounded network
timeouts and sanitized errors. Identity tokens, raw nonce/state values, raw
reauthentication proofs, Apple subjects, and Privy DIDs are never written to
logs, analytics, screenshots, or durable challenge rows. Raw values exist in
process memory only for the verification request. A keyed provider-identity
digest may be persisted solely to bind the attested challenge, but it is never
logged or exported.

An already-existing deletion tombstone is exempt from a new reauthentication
requirement. Status lookup, mobile pending-marker recovery, and idempotent
retry must continue to return that durable result after local data is gone or
the Apple session is unavailable. The exemption never permits creation of a
new deletion request.

This unit deliberately does not send or store `authorizationCode` or
`appleUser`, exchange an Apple authorization code, mint an Apple client secret,
store refresh/access tokens, or call Apple's revoke endpoint. The interactive
identity proof therefore does not satisfy the separate Apple revocation
blocker.

The independent `ACCOUNT_DELETION_RECENT_AUTH_READY` compile-time latch remains
`false`, and `ACCOUNT_DELETION_RECENT_AUTH_ENABLED` remains a closed runtime
kill switch.
Public request availability depends on that latch in addition to the existing
public-request, stable-identity, and provider-cleanup latches and runtime kill
switches. No Railway flag can bypass a closed compile-time latch.

## Options Considered

### Option A: Treat the current Privy access token as recent authentication

| Dimension | Assessment |
|-----------|------------|
| Client complexity | Low |
| Fresh user interaction | Not proven |
| Account binding | Session only |
| Replay resistance | Insufficient for deletion |

**Pros:** No new native prompt, backend route, or persistence.

**Cons:** A long-lived or stolen session can request irreversible deletion
without a new Apple interaction, and a client timestamp cannot repair that
gap.

### Option B: Reuse Privy login or account-linking OAuth

| Dimension | Assessment |
|-----------|------------|
| Privy integration | Familiar |
| Already-authenticated behavior | Unsuitable |
| Server challenge visibility | Insufficient |
| Linkage side effects | Possible |

**Pros:** Uses the same provider SDK as initial login.

**Cons:** Login is rejected for an already-authenticated user, linking is not
reauthentication, and the public callback does not expose a challenge-bound
Apple identity token for EasyGo's server to verify.

### Option C: Native Apple prompt with a server challenge and atomic consume

| Dimension | Assessment |
|-----------|------------|
| Fresh user interaction | Strong after device proof |
| Server verification | Strong |
| Replay/request binding | Strong |
| Platform coverage | iOS/Apple only |
| Complexity | Medium-high |

**Pros:** Produces a signed, challenge-bound Apple assertion and ties it to the
same stable provider identity, EasyGo session, deletion request, and database
transaction.

**Cons:** Requires native-device validation of Apple's nonce representation,
Apple JWKS handling, a new challenge table, and separate designs for Google and
Android users.

## Trade-off Analysis

Option C is the only option that proves both recent interaction and account
continuity without mutating Privy linkage. The additional challenge state is
intentional: it provides expiry, single-use replay protection, request binding,
and atomic rollback behavior that cannot be reconstructed from a bearer token.

The design prefers a false rejection to an unverified deletion. Unknown Apple
claims, a JWKS outage, a nonce/state mismatch, a changed DID, a missing stable
provider mapping, or an expired/used proof all stop the new request. Existing
tombstone recovery remains available because it is no longer authorizing a new
destructive action.

The foundation accepts temporary in-memory handling of an identity token but
does not expand that boundary to authorization-code or refresh-token custody.
That keeps recent authentication separate from revocation, but it means a
dedicated Sign in with Apple key and immediate code-exchange/revocation design
still must be implemented and reviewed before activation.

## Consequences

- Account deletion remains visibly unavailable; all compile-time activation
  latches and Railway runtime flags stay closed.
- iOS gains a dormant, explicit Apple prompt between deletion confirmation and
  the destructive request. Cancellation or failure leaves the account and
  Privy session intact.
- A requesting device marker always checks server status first. If no
  tombstone exists, it obtains a fresh Apple proof and retries with the same
  request ID; it never reuses or persists a proof.
- The backend gains short-lived challenge state, Apple JWT/JWKS verification,
  stable-subject matching, an opaque proof, and transactional one-time consume.
- Challenge issuance requires an activation-time rate limit and explicit
  digest-retention decision even though raw credentials are never stored.
- Raw Apple assertions and challenge secrets require explicit request/log
  redaction and must never appear in exports or diagnostics.
- An Apple-authenticated account with an ambiguous or changed provider subject
  fails closed and requires investigation; no DID-only fallback is allowed.
- Google-only accounts and Android still lack an equivalent recent-auth flow.
- Several legacy on-device safety/search keys are not owner-namespaced. They
  must be migrated or account switching must share a serialization boundary
  with cleanup before the dormant path can activate.
- Apple authorization-code exchange and revocation remain independently
  unresolved.
- Migration, PostgreSQL concurrency/replay tests, and real-device QA are
  release gates, not post-release follow-ups.

## Action Items

1. [x] Add the dormant server challenge, verification, proof, and atomic
   consumption foundation behind a closed compile-time latch.
2. [x] Add the dormant iOS `AppleAuthentication.signInAsync` state machine and
   fixed, credential-free cancellation/error copy.
3. [ ] With a reviewed internal-only diagnostic that cannot call the deletion
   endpoint, prove on a disposable physical iPhone whether the Apple JWT nonce
   is the raw supplied nonce or a transformed representation; lock that
   behavior in server/device tests and remove the diagnostic from release
   builds.
4. [ ] Backfill and audit the immutable Apple mapping for every eligible local
   user, then prove that the native Apple JWT `sub` derives to that same digest
   for new and returning staging users. Do not silently create a mapping in a
   deletion request and do not add a DID fallback.
5. [ ] Provision and review a dedicated Sign in with Apple key, Team ID, Key
   ID, and immediate authorization-code exchange, secure token retention, and
   revocation flow. No key or token may enter the client bundle or repository.
6. [ ] Design and test equivalent recent authentication for Google-only users
   and Android before those login methods can coexist with deletion.
7. [ ] Apply the migration and pass PostgreSQL expiry, parallel challenge,
   replay, rollback, and deletion-race tests in staging.
8. [ ] Complete disposable-account physical-device QA, provider cleanup QA,
   and legal/operational approval before reviewing any latch change.
9. [ ] Approve and implement issuance rate limiting plus a concrete lifecycle
   for expired unconsumed rows and tombstone-referenced consumed rows before
   activation; the current restrictive audit FK intentionally prevents
   consumed-row pruning.
10. [ ] Owner-namespace the on-device search/safety data and push-token state,
    or prove and document a single auth-switch/cleanup serialization boundary,
    before enabling device cleanup.
