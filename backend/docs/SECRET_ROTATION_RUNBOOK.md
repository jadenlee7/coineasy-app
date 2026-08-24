# EasyGo staging credential exposure and rotation runbook

Status: plan only. No credential has been rotated, revoked, or reissued under
this document.

This runbook covers credential material emitted into a restricted internal tool
transcript during a read-only Railway metadata investigation on 2026-08-25
(Dubai time). It does not assert external access, misuse, or customer-data
exposure. The incident remains open until transcript access is reviewed and
every affected credential category has an approved disposition and receipt.

The provisional operational classification is SEV4 because no service or
customer-visible failure was observed. The security remediation priority is P1
because reusable credential material appeared in a retained transcript.
Escalate to SEV3 or higher immediately if transcript access is broader than
expected or provider, database, or audit evidence indicates unauthorized use.

## Non-negotiable controls

- Never paste a current or replacement value into Git, a PR, chat, a ticket,
  shell history, or a tool transcript.
- Do not use bulk Railway environment/configuration/variable JSON queries. They
  may return plaintext values even when the intended question is metadata-only.
- Use a provider UI, sealed variable input, password manager, or non-transcribed
  operator shell for secret generation and entry. Git records only variable
  names, timestamps, deployment IDs, approvers, and pass/fail receipts.
- Issue and validate a replacement before revoking the old credential when the
  provider and risk assessment permit overlap. Do not dual-accept an exposed
  `ADMIN_SECRET`, and do not preserve overlap when active misuse is suspected.
- Apply Railway variable changes with deploys staged or skipped, review every
  affected consumer, then deploy services deliberately. Do not restart the
  volume-backed Postgres service merely to rotate an application credential.
- Keep all optional feature flags and account-deletion execution latches closed
  throughout rotation.

## Repo-safe disposition matrix

The exact affected-value inventory belongs in a restricted incident record
outside Git. This table maps repository variable names to the safe default
disposition without recording any value.

| Credential category | Consumers and risk | Disposition |
| --- | --- | --- |
| Database credentials represented by `DATABASE_URL` | Web, segment worker, account-deletion worker, Prisma deploy/status/seed, backup/recovery, and one-off Railway jobs or shells; broad data read/write risk | Use a second least-privilege Postgres role and bounded overlap; move every consumer before dropping the old role |
| `ADMIN_SECRET` | Web `POST /orange/earn`; possession authorizes an Orange ledger write | Coordinate a single-secret cutover or temporarily disable the endpoint; never dual-accept old and new values |
| `PRIVY_APP_SECRET` | Web Privy client for token verification and user lookup | Confirm current provider support; use bounded overlap if supported or an approved atomic cutover if not, then redeploy and verify |
| `ACCOUNT_DELETION_SUBJECT_HMAC_KEY` | Permanent keyed tombstones, stable-provider digests, and key fingerprint registry at key version 1 | **Do not replace directly.** Design and ship a versioned keyring/dual-read release first; retain v1 for rows that cannot be re-derived |
| `ACCOUNT_DELETION_ENCRYPTION_KEY` | AES-256-GCM ciphertext on pending deletion requests at encryption version 1 | **Do not replace directly.** First count rows by key version without selecting ciphertext, then ship versioned decrypt/re-encrypt support or prove no row depends on v1 |

`PRIVY_APP_ID`, mobile client IDs, `SQUID_INTEGRATOR_ID`, `RELEASE_SHA`, and
`EASYGO_CONSENT_VERSION` are identifiers rather than reusable authentication
secrets and are not rotated solely because of this incident. Any additional
credential category discovered during restricted inventory must be added to the
off-repo receipt before action.

## Phase 0 — containment and inventory

1. Preserve the incident reference without copying the secret-bearing payload.
2. Confirm transcript ACL, sharing, export/download history, retention, and
   deletion/restriction options. Record only the result and reviewer.
3. In a restricted provider-side session, inventory affected credential
   categories and their consumers. Do not retrieve current values merely to
   compare them.
4. Review Privy, Railway, Postgres, and application logs for unauthorized use
   since the transcript event. Store only event IDs and conclusions in the
   repo-safe receipt.
5. Confirm current staging health and keep signing, swap execution, provider
   cleanup, and other dormant features disabled.

## Phase 1 — independently revocable credentials

The default risk order is database credential, `ADMIN_SECRET`, then
`PRIVY_APP_SECRET`. If audit evidence indicates active misuse, assign separate
owners and contain those credentials in parallel instead of waiting for this
sequence. The subsections below define each cutover, not permission to execute
it under this plan-only document.

### `ADMIN_SECRET`

1. Identify every legitimate caller of `/orange/earn`; an unknown caller is a
   stop condition.
2. Generate a replacement in a non-transcribed secure session. Temporarily
   disable the endpoint if the trusted caller and web service cannot switch as
   one controlled cutover; never accept both values concurrently.
3. Deploy the web service with `/ready` as its health check.
4. From a secure operator session, send the new `x-admin-secret` with exactly
   `{}` as the body. HTTP 400 proves the new secret passed authentication and
   stopped at schema validation, while HTTP 401 means it did not. Do not send a
   real user, reward, or idempotency key for this non-writing probe.
5. Confirm the old credential receives HTTP 401, verify zero Orange ledger
   writes from both probes, observe the normal error baseline, then record the
   revocation receipt. If the new credential fails, keep the endpoint disabled
   and forward-fix; do not restore the exposed credential.

### `PRIVY_APP_SECRET`

1. A Privy Admin first confirms the dashboard's current app-secret behavior in
   an approved provider session and records only whether multiple simultaneous
   secrets are supported. Do not infer overlap support from this repository.
2. If overlap is supported, create a replacement while the old secret remains
   valid for a bounded window. If only one secret is supported, schedule an
   atomic provider/Railway cutover with an explicitly accepted authentication
   interruption; never claim an overlap window in that branch.
3. Stage the replacement Railway web value without echoing it and redeploy the
   exact reviewed release; the Privy client is created from environment values
   at module load, so a variable edit without a redeploy is insufficient.
4. Verify `/health`, `/ready`, and authenticated `GET /auth/me` with an existing
   staging session. Separately verify one read-only Privy `getUser` call from a
   secure, non-transcribed operator path. Do not use `/auth/sync` for this
   credential probe because that route can mutate database identity state.
5. Observe authentication errors for at least 15 minutes. In the overlap
   branch, only then delete the old Privy app secret and repeat both read-only
   checks. In the single-secret branch, record the provider cutover receipt and
   use a newly issued secret for any forward fix.
6. Do not change the public Privy App ID, mobile client ID, bundle identifier,
   or URL scheme during this rotation.

### Database credentials

1. Prefer a second least-privilege Postgres login with equivalent required
   grants. Both old and new roles remain valid during the overlap window.
2. Inventory web, segment worker, account-deletion worker, migration/status/
   seed commands, backup/recovery automation, and one-off Railway jobs or
   shells. Update every shared/reference variable, or stage consumer changes
   together when they are not shared. Never leave a dormant process or
   maintenance path pointing at a revoked role.
3. Deploy every resident consumer deliberately. `/ready` must exercise the new
   database connection; workers must retain their expected flag-off dormant
   behavior.
4. Run value-safe preflight, Prisma migration status, read-only GET smoke, and
   a 15-minute 5xx/error watch.
5. Reassign ownership if required and drop the old role only after every
   consumer is verified. Do not restart the Postgres service for this change.
6. If active database misuse is suspected, skip the overlap strategy, revoke
   the affected role, accept the bounded outage, and issue a fresh role for a
   forward fix.

## Phase 2 — versioned cryptographic-key migration

The current code pins both account-deletion key versions to `1`. The database
stores the HMAC key fingerprint and fails closed if an unplanned replacement is
present. Pending provider identity ciphertext also requires the matching
encryption key version. Direct replacement would therefore break tombstone
lookup, auth sync, or provider cleanup.

Before either key changes:

1. Query only aggregate row counts grouped by key version. Never select a
   provider identity, digest, ciphertext, lease, or raw subject into an
   operator transcript.
2. Design a reviewed keyring with explicit active and readable versions.
3. Keep HMAC v1 available for permanent tombstones that cannot be re-derived.
   For each lookup, calculate candidate hashes with every readable key version,
   lock and query every variant in the same transaction, and reject any
   cross-version tombstone or identity collision. Apply the same rule to DID,
   provider-identity, and reauthentication-challenge paths so a new v2 record
   can never treat an existing v1 identity as a different user.
4. Add versioned encryption decrypt support, re-encrypt eligible pending rows
   transactionally, and prove no remaining ciphertext requires v1 before
   retiring it.
5. Deploy and verify the keyring-aware dual-read release to every consumer
   before allowing any v2 write. Record its exact release and deployment as the
   new minimum safe rollback baseline. After the first v2 write, every
   pre-keyring release is ineligible for rollback; preserve both encryption
   keys until migration is complete.
6. Add unit, database, restart, rollback, and disposable-account QA. Keep all
   public deletion and provider-cleanup gates closed until that release passes.
7. Treat inability to account for any versioned row as a hard stop, not
   permission to delete or overwrite it.
8. Record the residual privacy risk that retaining an exposed HMAC v1 key
   weakens pseudonymization of existing digests, and require a security/data
   owner decision before treating that disposition as complete.

## Validation and rollback gates

| Check | Pass condition | Stop or rollback condition |
| --- | --- | --- |
| Service health | `/health` and `/ready` return 200 with the intended release | Two consecutive readiness failures |
| Authentication | Existing-session `GET /auth/me` and secure read-only Privy `getUser` succeed | Repeated bearer verification, provider-read, 401, or 503 failure |
| Database | Prisma status is current and representative reads succeed | Connection, permission, or migration error |
| Orange admin | Invalid-body secure probe returns 400 and creates no ledger row | 401 with new credential or any write from probe |
| Worker | Expected dormant start/stop sequence while flag is false | Fatal/restart loop or use of revoked DB role |
| Observability | 15-minute 5xx and application-error baseline remains nominal | New fatal, sensitive logging, or material 5xx increase |
| Crypto migration | Every row is attributable to a supported key version | Unknown version, `account_deletion_hash_key_mismatch`, auth-sync 503, or decrypt failure |

An exposed database or Privy credential may be used as a temporary pre-
revocation fallback only when transcript ACL is confirmed restricted, the
security owner or incident commander explicitly approves it, a short expiry is
recorded, and an audit receipt binds the fallback to issuing another
replacement. Absence of misuse evidence alone is insufficient. This exception
never applies to `ADMIN_SECRET`: keep the endpoint disabled and forward-fix.
After any old credential is revoked, do not restore it; issue another
replacement or forward-fix. Under the approved normal-overlap path, database
role revocation waits until all old connections and consumers are accounted
for.

## Secret-free receipt template

Store the detailed receipt outside Git when it could reveal account or provider
metadata. A repo-safe summary may contain only:

```text
Credential category:
Owner / approver:
Issued at (UTC):
Consumers updated:
Deployment IDs:
Validation checks:
Old credential revoked at (UTC), or retained reason:
Transcript ACL disposition:
Open risks / next review:
```

## Official provider references

- [Railway zero-downtime credential rotation](https://docs.railway.com/guides/rotate-credentials-zero-downtime)
- [Railway database credential regeneration](https://docs.railway.com/databases/database-view)
- [Privy app credentials](https://docs.privy.io/basics/get-started/dashboard/create-new-app)
- [Privy teammate roles and app-secret permissions](https://docs.privy.io/basics/get-started/dashboard/teammate-roles)

The event summary and outstanding actions are tracked in
[`incidents/2026-08-25-internal-config-output-exposure.md`](./incidents/2026-08-25-internal-config-output-exposure.md).
