# Incident: internal configuration output contained credential material

- **Date:** 2026-08-25 (Dubai time)
- **Operational severity:** Provisional SEV4
- **Security remediation priority:** P1
- **Status:** Identified — remediation pending

## Summary

During a read-only Railway staging investigation, a broad configuration query
returned credential material together with deployment metadata. The response
completed and was retained in an internal tool transcript. One subsequent
fixed-allowlist projection emitted metadata only; further configuration and
variable queries then stopped. Values were not repeated into Git or the
user-facing report.

No customer-visible outage or request failure was observed. No evidence of
external access or credential misuse has been established as of this review.
Transcript access review, credential disposition, and rotation remain open, so
this incident is not resolved or fully contained.

## Scope

- Affected system: internal operational tool transcript for Railway staging
  investigation.
- Service impact observed: none; the staging web deployment and smoke QA
  completed independently and remained healthy.
- Customer data exposure: not established.
- External access or misuse: not established.
- Credential rotation or revocation completed: none.
- Secret values, transcript links, and the restricted credential inventory are
  intentionally excluded from this repository.

Escalate to SEV3 or higher if transcript ACL is broader than expected, a copy
was externally shared, exported, or downloaded beyond approved incident
handlers, or provider/database evidence indicates unauthorized access or use.

## Timeline

| Time | Event |
| --- | --- |
| 2026-08-25 T0 | Read-only review of Railway staging service, deployment, and source metadata began. |
| T0+ | A broad environment/configuration response returned metadata and credential values into the internal tool transcript. |
| Immediately after detection | Credential values were not repeated. One fixed-allowlist projection produced metadata-only output, and further configuration/variable queries stopped. |
| Last recorded status check | The staging web deployment remained healthy; transcript ACL review, misuse audit, and credential disposition remain pending. |

The exact secret-bearing payload and its link remain outside this repo. Preserve
them only if required by the restricted security review and platform retention
policy.

## Root cause and contributing conditions

The read-only command's output contract was not metadata-only: configuration
metadata and credential values were returned in the same response. The tool
environment automatically retained stdout, and the operations runbook did not
yet prohibit this query class or require a fixed metadata projection.

This is a process and control gap, not an individual fault. Read-only access
does not make a command safe when its response contains secret-bearing fields.

## Actions taken

- Stopped further bulk variable/configuration queries.
- Avoided copying credential values into repository files, PRs, or the
  user-facing report.
- Used one fixed-allowlist projection for metadata-only output, then stopped
  further configuration and variable queries.
- Drafted the credential-disposition and rotation workflow in
  [`../SECRET_ROTATION_RUNBOOK.md`](../SECRET_ROTATION_RUNBOOK.md).

## Action items

| Priority | Owner role | Status | Due / next review | Action | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| P0 | Incident commander and platform owner | Partial — local metadata reviewed; platform history unobserved | Before any credential rotation | Confirm transcript ACL, sharing, retention, and download/export history | Secret-free reviewer receipt |
| P0 | Platform owner | Partial — local transcript restricted; platform copies pending | Immediately after ACL review | Restrict or safely dispose of retained copies where platform controls permit | Platform receipt or documented limitation |
| P1 | Security reviewer plus provider/database owners | Partial — Railway/app window reviewed; remaining surfaces unobserved | Before credential disposition | Review provider, database, and application audit evidence and record coverage limits | Secret-free audit conclusion and event IDs |
| P1 | Credential owners | Blocked on ACL and audit review | Before any rotation approval | Inventory affected credential categories in a restricted channel | Owner-approved rotate/retain decision for each category |
| P1 | Service owners and incident commander | Blocked on inventory and separate execution approval | Approved maintenance window | Rotate independently revocable authentication and database credentials | New deployment checks plus old-credential revocation receipts |
| P1 | Backend/data owner plus security reviewer | Planned | Separate code release before either key changes | Design versioned multi-key migration for account-deletion HMAC and encryption keys | Approved code/data migration plan, rollback baseline, and tests |
| P1 | Backend operations owner | Planned | Before the next Railway metadata inspection | Add a metadata-only Railway inspection wrapper that cannot serialize variable values | Tests proving value fields cannot be emitted |
| P2 | PR author and reviewer | Partial — working document/body scan complete; immutable PR scan pending | Before merge | Run a secret-safe scan over the changed incident document and final Draft PR material | Final commit and posted PR body count-only receipt |

## Phase 0 secret-free audit receipt (2026-08-25)

The locally retained transcript was inspected by metadata only; its contents
were not opened, read, searched, or copied. Its POSIX mode changed from `0644`
to owner-only `0600`, with ownership unchanged. The metadata inspection reported
no extended ACL entries. Server-side task ACLs, shared-link history,
download/export history, retention, backups, and imported copies remain
unobserved and require the platform-owner review above.

The repository is a public fork, so repository and PR material was scanned
separately from the restricted incident evidence. At
`2026-08-24T22:03:19Z`, a count-only scan of the working incident document and
proposed Draft PR body found zero matches for private-key markers,
bearer-token shapes, PostgreSQL URIs, Privy subjects, EVM addresses, JWT shapes,
email addresses, or sensitive assignments. No transcript path, session
identifier, credential value, fingerprint, raw log, request identifier, IP
address, user agent, email address, Privy subject, or wallet address is retained
in this receipt.

The Railway staging web audit used count-only filters over an approximately
two-hour window (`2026-08-24T19:52Z`–`21:52Z`). This deliberately broad window
covered the known investigation period because exact T0 was not recorded. Raw
log bodies were not emitted into the receipt. The reviewed deployment was
`10ba0998-ca2d-429b-8a94-527b4db47ab0`, and nine HTTP request events were in the
window.

| Reviewed Railway/app signal | Count in stated window |
| --- | ---: |
| HTTP 5xx responses | 0 |
| `POST /orange/earn` requests | 0 |
| 401 responses on `/auth` or `/me` routes | 0 |
| 503 responses on `/auth` or `/me` routes | 0 |
| `/ready` 5xx responses | 0 |
| Application error-level events | 0 |
| Authentication failure events | 0 |
| Privy lookup-unavailable events during auth sync | 0 |
| Database readiness failures | 0 |
| Unhandled request errors | 0 |
| Fatal-stop events | 0 |
| Backend start events | 1 |
| Backend stop or stopping events | 0 |

A count-only scanner over the same application-log window found zero matches
for private-key markers, bearer-token shapes, PostgreSQL URIs, Privy subjects,
EVM addresses, JWT shapes, email addresses, or sensitive field names. These
zeros apply only to the stated Railway/application surfaces and time window;
they are not evidence about Privy provider logs, PostgreSQL audit logs, the
Codex/OpenAI platform, or activity outside the window. Those surfaces, the
exact T0, and the credential-category inventory remain unobserved.

Apart from the local POSIX permission hardening above, no credential was
rotated, revoked, or reissued, and no provider, database, Railway-variable,
deployment, deletion, archive, or retention mutation was performed as part of
Phase 0. The incident therefore remains open at provisional SEV4 / security P1
pending the outstanding platform and provider reviews and separately approved
remediation.

## Owner communication

The owner-facing status is: Railway staging metadata review caused credential
material to be emitted into an internal tool transcript. No customer-visible
outage or request failure was observed, and no evidence of external access or
misuse has been established as of the review time. No credential rotation or
revocation has been executed. The incident remains open pending transcript ACL,
audit, and credential-disposition reviews; actual values will not be repeated.

Provide the next update when the ACL and audit reviews complete, before any
credential rotation is executed, or immediately if severity or observed impact
changes.

## Resolution criteria

This incident may move to resolved only when transcript access is dispositioned,
provider/database/application audit coverage and limitations are recorded,
every affected credential category has an approved rotate/retain decision,
required rotations are verified and old credentials are revoked, and
cryptographic keys either complete a versioned migration or have a documented
containment rationale. Any retained HMAC v1 key requires an explicit residual-
privacy-risk decision because existing digest pseudonymization is weakened.
Customer or legal notification is a separate decision only if later evidence
establishes external access or personal-data impact.
