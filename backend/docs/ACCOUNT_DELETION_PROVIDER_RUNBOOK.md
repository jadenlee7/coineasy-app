# EasyGo account-deletion provider runbook

## Current release posture

The provider worker is a dormant foundation. Do not create a Railway service,
set `ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED=true`, set
`ACCOUNT_DELETION_ENABLED=true`, or manually delete a Privy user from this
runbook. All three compile-time latches are `false` and must remain so until the
activation checklist is approved.

Build 101 remains Apple TestFlight Internal Only. A build containing a disabled
worker or identity migration is not an account-deletion release candidate.

## Privacy boundary

Use only the internal `AccountDeletionRequest.id` in logs, alerts, tickets, and
screenshots. Never copy any of the following into an operational system:

- Privy DID or bearer token;
- Apple subject, email, authorization code, access token, or refresh token;
- provider-identity digest or DID subject digest;
- encrypted DID ciphertext or encryption/HMAC key fingerprint;
- worker lease token;
- provider request URL, response body, or raw exception.

If diagnosis genuinely requires a provider identity, use a separately approved
break-glass procedure with least-privilege access and an audited reviewer. This
repository does not define or authorize that procedure.

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

1. Keep both runtime flags off if the issue could affect more than one request.
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
      captures/exchanges/revokes an appropriate Apple token.
- [ ] Recent interactive authentication is required before deletion.
- [ ] Stable identities cover every enabled account-creation method, including
      Google before Google signup remains enabled.
- [ ] The Apple disposition schema represents actual, not inferred, outcomes.
- [ ] Database migration, concurrent claim, lease expiry, stale fencing,
      backoff, all-`404` manual review, log redaction, and concurrent post-write
      rollback/recovery tests pass on staging.
- [ ] Disposable staging accounts with empty wallets pass end-to-end deletion,
      retry, relogin, and account-switch QA.
- [ ] Backup/restore, Telegram/AMA, telemetry, and exported-file policies are
      approved and reflected in user-facing copy.
- [ ] A least-privilege Railway worker service and alert owner are approved.
- [ ] Cleanup is enabled internally before the public request gate, and a new
      internal-only build passes device QA.

Any unchecked item keeps all three compile-time latches closed.
