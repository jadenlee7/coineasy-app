# EasyGo account-deletion provider runbook

## Current release posture

The provider worker is a dormant foundation. Do not create a Railway service,
set `ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED=true`, set
`ACCOUNT_DELETION_RECENT_AUTH_ENABLED=true`, set
`ACCOUNT_DELETION_ENABLED=true`, or manually delete a Privy user from this
runbook. All four compile-time latches are `false` and must remain so until the
activation checklist is approved.

Those latches are `ACCOUNT_DELETION_PUBLIC_REQUEST_READY`,
`ACCOUNT_DELETION_PROVIDER_CLEANUP_READY`,
`ACCOUNT_DELETION_RECENT_AUTH_READY`, and
`ACCOUNT_DELETION_STABLE_IDENTITY_GUARD_READY`. They are source constants, not
Railway variables.

Build 101 remains Apple TestFlight Internal Only. A build containing a disabled
worker or identity migration is not an account-deletion release candidate.

## Privacy boundary

Use only the internal `AccountDeletionRequest.id` in logs, alerts, tickets, and
screenshots. Never copy any of the following into an operational system:

- Privy DID or bearer token;
- Apple subject, email, authorization code, access token, or refresh token;
- Apple identity token, reauthentication nonce/state, or opaque reauth proof;
- provider-identity digest or DID subject digest;
- encrypted DID ciphertext or encryption/HMAC key fingerprint;
- worker lease token;
- provider request URL, response body, or raw exception.

If diagnosis genuinely requires a provider identity, use a separately approved
break-glass procedure with least-privilege access and an audited reviewer. This
repository does not define or authorize that procedure.

## Recent reauthentication boundary

The Apple reauthentication flow described in ADR-0010 is a dormant safety
foundation, not an available deletion path. It uses the authenticated session
to request a five-minute server nonce/state, opens the native Expo
`AppleAuthentication.signInAsync` prompt, and asks the backend to verify the
Apple identity JWT. Verification must bind all of the following:

- current authenticated DID and the client's expected DID;
- deletion `clientRequestId` and server challenge ID;
- nonce and state hashes held by the server;
- Apple issuer, native-app audience, signature, and token lifetime;
- the signed Apple subject's digest matching the exact immutable
  `UserStableProviderIdentity` row owned by the current EasyGo account (never a
  newly observed Privy linkage); and
- registered deletion-subject HMAC key version and fingerprint.

The server returns an opaque proof only after all checks pass. A new deletion
request must consume that proof once, inside the same PostgreSQL transaction as
the local purge and tombstone creation. Expiry and consumption use the database
clock. A rolled-back purge also rolls back consumption so the same idempotent
request can recover; a committed request cannot replay its proof.

Issuing another challenge must not revoke an already-attested proof. Multiple
five-minute, request-bound challenges may therefore coexist. Before activation,
enforce a reviewed issuance rate limit and scheduled cleanup; opportunistic
pruning alone does not define retention for an account that never returns.
Consumed rows are currently retained by a restrictive tombstone audit FK, so
their lifecycle needs an explicit retention decision rather than a cleanup job
that cannot legally delete them.

Do not copy an identity token, nonce, state, proof, DID, Apple subject, or
provider digest into Railway commands, logs, tickets, screenshots, or manual
SQL. The foundation does not send or persist Apple's authorization code and
does not exchange or revoke an Apple token. Passing reauthentication tests is
therefore not evidence that the Apple revocation blocker is closed.

`GET /me/account-deletion` and idempotent recovery of an existing tombstone do
not require a new Apple prompt. That exception restores an already-authorized
deletion after local data or provider access is gone; it must never create a
new request.

## State interpretation

| State | Operational meaning |
|---|---|
| `REQUESTED` | Intent exists; local purge has not been durably confirmed. |
| `LOCAL_PURGED` | EasyGo-owned user data was purged; provider work is pending. |
| `APPLE_REVOKED` | An approved Apple adapter proved revocation. Do not set manually. |
| `PRIVY_DELETED` | Privy DELETE returned its documented success response. |
| `COMPLETED` | Provider work finished and encrypted DID material was erased. |
| `MANUAL_REVIEW` | Automation stopped without claiming completion. |

A `202` returned to mobile means local purge was accepted. It does not mean
Apple authorization, Privy identity, embedded wallet, or blockchain history
has been deleted.

## Automated retry policy

- Claims use an expiring lease and state-version fencing.
- A successful stage resets its own attempt counter.
- Timeout, transport failure, `429`, and `5xx` use bounded jittered backoff.
- Privy `401`/`403` and configuration failures stop the cycle and alert; they
  must not fan out into many user-level manual-review records.
- Every Privy `404` is unproven and goes to manual review. A retry counter or
  earlier timeout is not sufficient evidence that a prior DELETE succeeded.
- Corrupt ciphertext or inconsistent stable-identity topology goes to manual
  review and never triggers a provider call.

## Manual-review response

1. Keep all three runtime flags off if the issue could affect more than one
   request.
2. Record only request ID, state, sanitized error code, attempt count, release,
   and timestamps.
3. Verify the deployed release, database migration state, key fingerprints,
   Apple revocation mode, and Privy environment without printing their values.
4. Distinguish a global credential/configuration outage from one corrupt row.
5. Do not mutate a tombstone, reset a state, replay a provider call, or clear
   ciphertext without two-person approval and a separately reviewed tool.
6. If there is any uncertainty, leave the row in `MANUAL_REVIEW`; do not mark
   `COMPLETED` from a dashboard screenshot or an absent local `User` row.

## Activation checklist

- [ ] Product and Legal approve permanent stable-identity retention and
      re-registration behavior.
- [ ] Apple revocation ownership has written evidence, or EasyGo securely
      captures, immediately exchanges, securely stores, and revokes an
      appropriate Apple token with a dedicated Sign in with Apple key, Team ID,
      and Key ID.
- [ ] Physical-device evidence proves the raw-versus-transformed Apple nonce
      contract and native Apple subject equivalence with Privy's stable subject
      for both new and returning users. Use a reviewed internal-only diagnostic
      that cannot invoke deletion, then remove it from the release graph.
- [ ] Recent interactive authentication is required before every new deletion,
      with short expiry, session/DID/request binding, single-use atomic consume,
      sanitized failures, and existing-tombstone recovery preserved.
- [ ] Equivalent recent authentication is approved for Google-only users and
      Android, or those account-creation methods are unavailable when deletion
      is activated.
- [ ] Stable identities cover every enabled account-creation method, including
      Google before Google signup remains enabled.
- [ ] Every eligible existing user has an audited immutable Apple mapping;
      missing or changed mappings fail before proof consumption and are never
      backfilled by the deletion route.
- [ ] The Apple disposition schema represents actual, not inferred, outcomes.
- [ ] Database migration, concurrent claim, lease expiry, stale fencing,
      backoff, all-`404` manual review, reauth expiry/replay/parallel consume,
      log redaction, and concurrent post-write rollback/recovery tests pass on
      PostgreSQL staging.
- [ ] Recent-auth challenge issuance has an approved rate limit, and expired
      unconsumed plus tombstone-referenced consumed digests have an approved,
      implementable retention policy.
- [x] On-device search, safety, push-registration, and course keys are hashed by
      Privy owner, guarded by a session epoch, serialized per owner, sealed
      before deletion, and verified after purge. Ambiguous global legacy values
      are discarded rather than attributed; export-file work has its own
      serialization boundary. Physical transition evidence is still required
      below.
- [ ] Disposable staging accounts with empty wallets pass end-to-end deletion,
      retry, relogin, and account-switch QA.
- [ ] Backup/restore, Telegram/AMA, telemetry, and exported-file policies are
      approved and reflected in user-facing copy.
- [ ] A least-privilege Railway worker service and alert owner are approved.
- [ ] Cleanup is enabled internally before the public request gate, and a new
      internal-only build passes device QA.

Any unchecked item keeps all four compile-time latches closed. A Railway
runtime-variable change cannot bypass them.
