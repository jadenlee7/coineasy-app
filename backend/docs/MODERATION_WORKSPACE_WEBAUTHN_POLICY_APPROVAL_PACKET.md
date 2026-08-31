# EasyGo moderation Workspace OIDC and WebAuthn policy approval packet

**Status:** Proposed candidates only; all operating approvals are pending

**Packet date:** 2026-08-31

**Source baseline:** `977c6125cefa5b12cd0eff929ad21f3b8ee0cc4b`

**Required deciders:** Product, Backend, Security, Privacy/Legal, Operations,
and a named moderation owner

## Purpose and authority

This packet turns the architecture direction selected in
[ADR-0014](./adr/0014-moderation-operating-policy-selection.md) into one
reviewable set of exact operating-policy candidates. It separates a proposed
value from external provider evidence and from the people who must approve and
operate it.

Creating, reviewing, merging, or citing this packet does **not** select or
approve any candidate. It does not authorize implementation, a Google Cloud or
Workspace change, DNS or TLS work, a reviewer, a database change, migration,
Railway configuration, deployment, singleton wiring, source-latch change,
runtime activation, or moderation action. No value in this packet may be
copied into an environment until the applicable approval and activation step
in ADR-0014 is separately authorized.

The source latch is confirmed closed:

```text
POST_MODERATION_READY=false
```

This packet requires `POST_MODERATION_ENABLED=false` before every later
gate-off step, but its current Railway value is not re-observed by this
documentation change. The production singleton, current database targets,
provider state, and reviewer state are unchanged and unobserved here.

## Status legend

| Status | Meaning |
| --- | --- |
| `SELECTED_DIRECTION` | ADR-0014 selected the architecture direction, not an operating value or configured provider |
| `PROPOSED_CANDIDATE` | Exact value proposed for joint review; not a runtime value or approval |
| `RATIFIED_FOR_PROOF` | All deciders accepted one candidate version only as the input to a separately approved non-production proof |
| `EXTERNAL_PROOF_REQUIRED` | Google, DNS, TLS, origin, database, or other readback is required before selection |
| `HUMAN_NAME_REQUIRED` | A real primary person, backup, contact path, and acceptance receipt are required |
| `UNSELECTED_STOP` | No safe exact candidate exists yet; final operating acceptance and implementation must stop |
| `APPROVED_OPERATING_VALUE` | All deciders accepted the exact value after required external proof |
| `SEPARATE_APPROVAL_REQUIRED` | A later implementation, migration, deployment, QA, or activation gate is required |
| `REJECTED` | This packet does not permit the option |

Candidate ratification and final operating acceptance are different decisions:

1. All required deciders may ratify one exact candidate version for proof.
   This permits only a later request for separate non-production proof approval;
   it does not approve an operating value or execute the proof.
2. A separately approved provider-proof run records value-safe external
   receipts against that exact ratified version.
3. The same decider disciplines review the receipts, resolve every
   `UNSELECTED_STOP` and `HUMAN_NAME_REQUIRED` row, and record final operating
   acceptance. Only then can a value become `APPROVED_OPERATING_VALUE`.
4. Source implementation remains a separate approval after final acceptance.

This order avoids treating unobserved provider facts as approved while still
allowing those facts to be measured safely.

## 2026-08-31 nomination and appeal candidate amendment

The task owner accepted the role-mapping recommendation and appeal Option A as
candidate input. That direction is not evidence that any named nominee accepted
the role, that Privacy/Legal reviewed the policy, or that any discipline
ratified this packet. Contact paths, backups marked pending, dated acceptance
receipts, and every decision in the ratification tables remain required.

The prior `2026-08-30-v1` identifiers were never ratified. Whether any matching
string was copied into an external environment remains unobserved. The
candidate changes below create a new `2026-08-31-v2` documentation proposal
rather than treating the earlier proposal as an accepted record or runtime
receipt.

## Candidate policy records

| Record | Candidate immutable version | Status |
| --- | --- | --- |
| Integrated moderation policy | `easygo-moderation-policy-2026-08-31-v2` | `PROPOSED_CANDIDATE` |
| Retention policy | `easygo-moderation-retention-2026-08-31-v2` | `PROPOSED_CANDIDATE` |
| Actor-rate policy | `easygo-moderation-rate-2026-08-31-v2` | `PROPOSED_CANDIDATE` |

These strings are proposal identifiers only. They must not be set as
`MODERATION_POLICY_VERSION` or `MODERATION_RETENTION_POLICY_VERSION` unless the
packet is jointly accepted and the later configuration step is separately
approved.

## Existing source constraints and ADR invariants

The following are existing source safety ceilings and accepted ADR invariants,
not approved production defaults. The future action grant and restore
procedure are not yet implemented merely because their bounds appear here:

- operator session and general MFA age cannot exceed eight hours;
- destructive proof cannot exceed 900 seconds at commit;
- GCRA emission intervals must be from 1,000 through 3,600,000 ms;
- GCRA burst capacity must be from 1 through 100;
- interval times burst cannot exceed 3,600,000 ms;
- `Retry-After` must be an integer from 1 through 3,600 seconds;
- restored rate state stays gate-off for the approved full-debt horizon,
  which the source bounds to no more than one hour, unless conservative
  reconstruction is proven;
- rate-store work must finish at least 250 ms before the outer two-second
  dependency deadline; and
- `REMOVE_POST` consumes `report.decide` and `content.remove` atomically.

The proposed candidates below may narrow these bounds but never widen them.

## Google Workspace and OIDC bootstrap

Google establishes workforce identity only. It does not grant an EasyGo
capability, prove a destructive step-up, or become the moderation API
credential.

| Field | Exact candidate | Status and required evidence |
| --- | --- | --- |
| Workforce domain | Signed ID-token `hd` must equal `coineasy.xyz` | `EXTERNAL_PROOF_REQUIRED`: Workspace domain type and actual token receipt |
| Cloud project topology | Separate staging and production projects, each parented by the Google Cloud Organization containing the approved Workspace domain | `PROPOSED_CANDIDATE` plus `EXTERNAL_PROOF_REQUIRED`; project IDs, numbers, parent organization, and named owners remain unobserved |
| Audience | `Internal` | `EXTERNAL_PROOF_REQUIRED`: console readback and external-account `org_internal` rejection |
| Environment separation | Dedicated Web OAuth client for staging and a different dedicated client for production | `EXTERNAL_PROOF_REQUIRED`; no client is created by this packet |
| Production browser origin | `https://moderation.coineasy.xyz` | `PROPOSED_CANDIDATE` plus DNS/TLS and routing proof |
| Production callback | `https://moderation.coineasy.xyz/auth/google/callback` | `PROPOSED_CANDIDATE` plus exact provider registration proof |
| Staging browser origin | `https://moderation-staging.coineasy.xyz` | `PROPOSED_CANDIDATE` plus DNS/TLS and routing proof |
| Staging callback | `https://moderation-staging.coineasy.xyz/auth/google/callback` | `PROPOSED_CANDIDATE` plus exact provider registration proof |
| OAuth flow | Server authorization code with PKCE `S256` only | `PROPOSED_CANDIDATE` |
| Requested scope | Exactly `openid email`; no `profile`, Google API, offline, or incremental scope | `PROPOSED_CANDIDATE`; provider proof must confirm exact granted scope and no refresh token |
| State | CSPRNG 32 bytes, keyed digest at rest, absolute 10-minute TTL, bound to one browser transaction, one-time consume | `PROPOSED_CANDIDATE` |
| Nonce | CSPRNG 32 bytes, keyed digest at rest, absolute 10-minute TTL, bound to the same transaction, one-time consume | `PROPOSED_CANDIDATE` |
| PKCE verifier | CSPRNG 32 random bytes encoded as 43-character unpadded base64url; server-side environment-key encryption because token exchange needs the original; 10-minute TTL; destroy on the first callback attempt | `PROPOSED_CANDIDATE` |
| Authorization endpoint | Server-pinned `https://accounts.google.com/o/oauth2/v2/auth` | `PROPOSED_CANDIDATE` plus discovery proof; never selected by request input |
| Token endpoint | Server-pinned `https://oauth2.googleapis.com/token` | `PROPOSED_CANDIDATE` plus discovery proof; never selected by callback input |
| Issuer | Exact `https://accounts.google.com` | `PROPOSED_CANDIDATE` plus actual-token proof; legacy `accounts.google.com` is not accepted unless separately reviewed |
| Authorization-response issuer | Callback `iss` must equal exact `https://accounts.google.com` before code exchange | `PROPOSED_CANDIDATE` plus positive/mismatch proof |
| Audience claim | Exact single environment-specific Web client ID | `EXTERNAL_PROOF_REQUIRED`; multi-audience tokens fail closed |
| Authorized presenter | If `azp` exists, it must equal the same approved client ID | `PROPOSED_CANDIDATE` plus actual-token proof |
| ID-token algorithm | `RS256` only | `PROPOSED_CANDIDATE` plus discovery, header, and JWKS proof |
| Header type | Missing is allowed; if present it must be exactly `JWT` | `PROPOSED_CANDIDATE`; do not require an undocumented optional header |
| JWKS | Server-pinned `https://www.googleapis.com/oauth2/v3/certs`; no redirects or token-selected key URL | `PROPOSED_CANDIDATE` plus discovery/cache/key-rotation proof |
| Bootstrap token age | `exp` valid, `iat` no more than 10 minutes old, 60-second maximum clock skew | `PROPOSED_CANDIDATE` |
| Identity key | Canonical issuer plus signed `sub`, protected before local lookup | `SELECTED_DIRECTION`; exact subject protection is proposed below |
| Hosted-domain enforcement | Exact signed `hd`; request `hd` is only an account-picker hint | `SELECTED_DIRECTION` plus `EXTERNAL_PROOF_REQUIRED` |
| Email, name, and picture | Never an identity key or capability; if email is displayed it requires `email_verified=true`; none is persisted in the operator session or moderation audit | `PROPOSED_CANDIDATE` |
| Google groups | Not used for v1 request-time access or automatic provisioning | `PROPOSED_CANDIDATE` |
| `auth_time` and `amr` | Optional risk signals only; never general or destructive EasyGo proof | `SELECTED_DIRECTION` |
| Access token | Never used for a Google API or persisted; discard after the ID-token validation transaction | `PROPOSED_CANDIDATE` |
| Refresh token | Not requested or stored | `PROPOSED_CANDIDATE` |

`External + Testing` is rejected for this workforce boundary. Google documents
an exception to test-user restrictions for Sign in with Google and requests
limited to OpenID identity scopes. `Internal` is only a provider-side first
boundary: the server must still require the exact hosted-domain claim and an
active, pre-provisioned EasyGo access record.

The current provider-neutral bearer verifier is a dormant source receipt, not
the Google activation path. The future selected path must not add an `OIDC OR
session` fallback, accept a Google token on moderation routes, copy Google
`iat` into EasyGo MFA time, or accept a client-supplied MFA boolean.

## Browser origin, opaque sessions, and CSRF

| Field | Exact candidate | Status |
| --- | --- | --- |
| Browser topology | UI, callback, and BFF/API share the exact environment origin; credentialed cross-origin CORS is disabled; operator pages use `frame-ancestors 'none'` | `PROPOSED_CANDIDATE`; direct Railway-origin bypass proof is external |
| OAuth correlation cookie | `__Host-easygo_mod_oauth`; opaque transaction ID only; server stores its keyed digest; `Secure; HttpOnly; SameSite=Lax; Path=/`; no `Domain`; 10 minutes | `PROPOSED_CANDIDATE` |
| Bootstrap cookie | `__Host-easygo_mod_bootstrap`; `Secure; HttpOnly; SameSite=Strict; Path=/`; no `Domain`; 10 minutes | `PROPOSED_CANDIDATE` |
| Operator cookie | `__Host-easygo_mod_session`; `Secure; HttpOnly; SameSite=Strict; Path=/`; no `Domain` | `PROPOSED_CANDIDATE` |
| Raw session identifier | CSPRNG 32 bytes, base64url; browser cookie only; never logged or persisted raw | `PROPOSED_CANDIDATE` |
| Database lookup | Versioned, moderation-specific HMAC-SHA-256 digest of the raw identifier | `PROPOSED_CANDIDATE` |
| Bootstrap authority | WebAuthn enrollment/authentication and CSRF-protected logout only | `SELECTED_DIRECTION` |
| Bootstrap lifetime | Absolute 10 minutes; no sliding refresh | `PROPOSED_CANDIDATE` |
| Operator lifetime | Absolute four hours and 30-minute inactivity timeout | `PROPOSED_CANDIDATE` |
| General WebAuthn assurance | 30 minutes; expiry requires a new general ceremony and atomic session rotation | `PROPOSED_CANDIDATE` |
| Concurrent operator sessions | One active session per actor; elevation revokes every prior actor session in the same transaction | `PROPOSED_CANDIDATE` |
| Access lookup | Read the PostgreSQL active access record on every request; no positive v1 cache | `PROPOSED_CANDIDATE` |
| Activity | Only a successful, CSRF-protected POST to `/moderation/reports/:reportId/claim` or `/moderation/reports/:reportId/decision` updates `lastInteractiveAt`; queue reads, polling, challenge creation, health, and readiness never do | `PROPOSED_CANDIDATE`; later routes require an explicit policy revision |
| CSRF token | Session-bound CSPRNG 32-byte synchronizer token sent in `X-EasyGo-CSRF` | `PROPOSED_CANDIDATE` |
| CSRF storage | Browser receives the raw token only from a same-origin no-store response; database stores a moderation-specific keyed digest only | `PROPOSED_CANDIDATE` |
| State-changing requests | Exact `Origin`; valid CSRF token; `Sec-Fetch-Site: same-origin`; `Sec-Fetch-Mode: cors` or `same-origin`; `Sec-Fetch-Dest: empty`; JSON only; missing/other Fetch Metadata fails closed | `PROPOSED_CANDIDATE` |
| GET semantics | GET never changes application state except the Google OAuth callback protocol endpoint, which may consume its one-time transaction, exchange the code at the pinned endpoint, and issue a constrained bootstrap session only after exact response `iss`, state, nonce, and PKCE validation | `PROPOSED_CANDIDATE` |
| Session rotation | Rotate after Google bootstrap and every general WebAuthn elevation; revoke the old session and CSRF token atomically | `SELECTED_DIRECTION` |
| Routine digest-key rotation | Every 90 days; previous key verifies existing sessions only until their original expiry, no more than four hours | `PROPOSED_CANDIDATE`; custody owner is required |
| Emergency rotation | Immediate local mass revocation; do not retain the compromised key for fallback | `PROPOSED_CANDIDATE` |
| Browser storage | No bearer/session token, client secret, or identity claim in URL, local storage, or session storage | `PROPOSED_CANDIDATE` |
| Logout | CSRF-protected POST; database revocation commits before cookies are cleared | `PROPOSED_CANDIDATE` |

The OAuth cookie is `Lax` only because the Google callback is a cross-site
top-level navigation. Operator and bootstrap cookies remain `Strict`.
`SameSite` is not a replacement for CSRF validation.

## WebAuthn and destructive action grant

| Field | Exact candidate | Status |
| --- | --- | --- |
| RP name | `EasyGo Moderation` | `PROPOSED_CANDIDATE` |
| Production RP ID | `moderation.coineasy.xyz` | `PROPOSED_CANDIDATE` plus DNS/TLS/origin proof |
| Production origin | Exact `https://moderation.coineasy.xyz` | `PROPOSED_CANDIDATE` plus browser proof |
| Staging RP ID | `moderation-staging.coineasy.xyz` | `PROPOSED_CANDIDATE` plus DNS/TLS/origin proof |
| Staging origin | Exact `https://moderation-staging.coineasy.xyz` | `PROPOSED_CANDIDATE` plus browser proof |
| Environment isolation | Staging credentials are never accepted in production and vice versa | `PROPOSED_CANDIDATE` |
| Challenge | Server CSPRNG 32 bytes; moderation-specific keyed digest only at rest | `PROPOSED_CANDIDATE` |
| Challenge lifetime | Five minutes; browser ceremony timeout 300,000 ms | `PROPOSED_CANDIDATE` |
| Outstanding challenge | One per actor/session/ceremony; issuing another revokes the earlier one | `PROPOSED_CANDIDATE` |
| Consumption | First terminal verification attempt consumes it atomically; retry needs a new challenge | `PROPOSED_CANDIDATE` |
| Registration verification | Exact `webauthn.create`, challenge, origin, RP ID hash, `UP=true`, `UV=true`, `crossOrigin=false`, allowed algorithm, unique credential ID, valid credential public key, and target actor/enrollment-grant binding | `PROPOSED_CANDIDATE` |
| Authentication verification | Exact `webauthn.get`, challenge, origin, RP ID hash, active credential ownership, public-key signature, `UP=true`, `UV=true`, and `crossOrigin=false` | `SELECTED_DIRECTION` |
| Algorithms | ES256 (`-7`) and RS256 (`-257`) only | `PROPOSED_CANDIDATE` |
| Attestation | `none` | `PROPOSED_CANDIDATE` |
| Discoverability | Resident key `preferred`; usernameless operator login is not enabled | `PROPOSED_CANDIDATE` |
| Authenticator attachment | Platform and roaming authenticators allowed | `PROPOSED_CANDIDATE` |
| Synced passkeys | Allowed; backup eligibility/state is recorded as a risk signal, not a capability | `PROPOSED_CANDIDATE` |
| Credential count | Maximum five active credentials per actor | `PROPOSED_CANDIDATE` |
| Activation minimum | Two distinct approved credential IDs per actor, preferably separate custody paths | `PROPOSED_CANDIDATE`; attestation `none` cannot prove hardware custody |
| Signature counter | A non-zero unexpected value is a Security risk signal and alert; it is not clone proof or replay defense and does not alone reject a valid synced-passkey ceremony | `PROPOSED_CANDIDATE` |
| General elevation | Consume challenge, revoke prior session, and issue the operator session in one transaction using the database clock | `SELECTED_DIRECTION` |
| Removal binding | Current session, actor, report ID, expected report version, post ID, expected post revision, action `REMOVE_POST`, and policy version | `PROPOSED_CANDIDATE` |
| Action grant | Server-side only, one use, 60-second TTL, bound to the unchanged operator session | `PROPOSED_CANDIDATE`; below the 900-second source ceiling |
| Removal commit | Lock and recheck active access, current session, unused grant, report/version, and post/revision; consume grant, redact content, and append audit atomically | `SELECTED_DIRECTION` |

Transport and authenticator-attachment hints do not prove a hardware-bound
credential. Requiring hardware-only credentials would require a separately
approved attestation and metadata trust policy.

## Enrollment, recovery, offboarding, and break-glass

| Procedure | Exact candidate | Status |
| --- | --- | --- |
| Normal provisioning | Requester and independent `access.admin` approver are different people; each approver uses a current UV WebAuthn session and one-time action grant bound to target actor, expected access version, exact capability change, and policy version | `PROPOSED_CANDIDATE` plus `HUMAN_NAME_REQUIRED` |
| First credential | Active pre-provisioned actor plus independent approver's UV WebAuthn action grant bound to target actor, expected access version, registration intent, and 15-minute expiry | `PROPOSED_CANDIDATE` |
| Additional credential | Current highest-assurance target session plus the same independently bound approval pattern; self-approval prohibited | `PROPOSED_CANDIDATE` |
| Genesis enrollment | Unselected: no authenticated first-actor mechanism, immutable receipt, single-purpose write path, and post-use disable proof is yet approved | `UNSELECTED_STOP`; Security and Operations must select a separate gate-off design |
| Activation minimum | At least two distinct `access.admin` actors and two approved credential IDs per active operator | `PROPOSED_CANDIDATE` |
| Lost credential | Local credential revoke followed by revocation of every actor session, grant, and challenge; independent approval before replacement | `PROPOSED_CANDIDATE` |
| Suspected compromise | Commit local deny and all local revocations first | `SELECTED_DIRECTION` |
| Local offboarding SLA | At most 15 minutes after the authoritative trigger | `PROPOSED_CANDIDATE` plus owner/on-call proof |
| Provider follow-up | Workspace suspend/sign-out/token revocation/group removal within 60 minutes after local deny | `PROPOSED_CANDIDATE` plus provider owner proof |
| Open claim handoff | Reassign through an audited procedure within 15 minutes after local revoke | `PROPOSED_CANDIDATE`; the current API has no reassign operation, so design and implementation need separate review |
| Access review | Every 30 days; record not reapproved by day 35 is locally denied | `PROPOSED_CANDIDATE` |
| Break-glass | No shared secret or bypass; two independent approvers, maximum 60-minute access record, WebAuthn and action grant still required | `PROPOSED_CANDIDATE` plus `HUMAN_NAME_REQUIRED` |
| Self-recovery | Google login, email, SMS, security questions, or a permanent recovery code alone are rejected | `REJECTED` |
| Last credential removal | Prohibited outside the approved recovery procedure | `PROPOSED_CANDIDATE` |
| Security notification | Every credential add/revoke and recovery sends a transaction-independent notice through the approved operator security channel with a repudiation/escalation path | `PROPOSED_CANDIDATE` plus `HUMAN_NAME_REQUIRED` |

Recovery starts with local denial and revocation; it never restores
`content.remove` from Google login alone. Google suspension and sign-out are
defense in depth, not the immediate authorization boundary.

## Access registry and capability mapping

| Field | Exact candidate | Status |
| --- | --- | --- |
| Registry | PostgreSQL provisioned allowlist | `SELECTED_DIRECTION` |
| Subject protection | HMAC-SHA-256 lookup digest plus separately keyed, environment-scoped AEAD ciphertext of canonical issuer and signed `sub`; neither appears in moderation audit or ordinary logs | `PROPOSED_CANDIDATE`; encryption and lookup key custody owners required |
| Subject-key rotation | Every 180 days or immediately after compromise; a dual-controlled maintenance job decrypts, re-encrypts, and re-HMACs every active record while preserving its `wf_...` actor ID | `PROPOSED_CANDIDATE` |
| Rotation completion | Old lookup/decryption keys are not retired until the job proves zero active records pending; any failed record is locally denied and blocks completion | `PROPOSED_CANDIDATE` |
| Exceptional rebind | Two independent `access.admin` UV action grants bind the newly proven subject to the existing actor and expected access version; self-rebind and automatic new actor creation are prohibited | `PROPOSED_CANDIDATE` |
| Actor ID | `wf_` plus CSPRNG 192-bit base64url value; three collision retries then fail closed | `PROPOSED_CANDIDATE` |
| Group reconciliation | Disabled in v1 | `PROPOSED_CANDIDATE` |
| Request-time authorization | Exact local active record and server-owned capabilities only | `SELECTED_DIRECTION` |
| Separation of duties | `access.admin` and `content.remove` cannot be active for the same actor | `PROPOSED_CANDIDATE` |
| Access change | Each required approver supplies a current UV WebAuthn one-time grant bound to actor, expected access version, exact capabilities, policy version, and expiry; consume, change, and audit are atomic; self-change prohibited | `PROPOSED_CANDIDATE` |

| Proposed local role | Exact capability allowlist |
| --- | --- |
| `queue_observer` | `queue.read` |
| `reviewer` | `queue.read`, `report.claim`, `report.decide` |
| `senior_reviewer` | `queue.read`, `report.claim`, `report.decide`, `content.remove` |
| `audit_reviewer` | `audit.read` |
| `access_administrator` | `access.admin` |

Roles are provisioning conveniences only. The request-time principal contains
the exact approved capability allowlist, never a wildcard or token role.

## Actor GCRA policy

These values are hypotheses for isolated staging load and concurrency tests.
They are not approved production thresholds.

| Scope | `emissionIntervalMs` | `burstCapacity` | Maximum candidate debt | Status |
| --- | ---: | ---: | ---: | --- |
| `queue.read` | 1,000 | 20 | 20 seconds | `PROPOSED_CANDIDATE` |
| `report.claim` | 5,000 | 6 | 30 seconds | `PROPOSED_CANDIDATE` |
| `report.decide` | 10,000 | 6 | 60 seconds | `PROPOSED_CANDIDATE` |
| `content.remove` | 60,000 | 2 | 120 seconds | `PROPOSED_CANDIDATE` |

Additional candidate policy:

- `REMOVE_POST` consumes `report.decide` and `content.remove` together;
- gate-off policy transition waits at least the larger old/new debt horizon;
- policy version or fingerprint mismatch returns sanitized unavailable and
  writes no bucket;
- after a database restore, remain gate-off for one hour unless a reviewed
  conservative reconstruction proves equivalent debt;
- cleanup considers only rows whose TAT is not in the future and whose
  `updatedAt` is at least seven days old;
- cleanup runs at most hourly in batches of 500 using `SKIP LOCKED`; and
- ten or more same-actor/scope `429` outcomes within five minutes and every
  mismatch/unavailable outcome are alert candidates.

Exact concurrency, latency, alert noise, cleanup, and restore evidence remain
`EXTERNAL_PROOF_REQUIRED` before these candidates can be selected.

## Retention, deletion, legal hold, and backup

Every period below requires Privacy/Legal, Product, Security, and Operations
approval. Expiry does not authorize an application role to hard-delete content
or audit records outside the approved purge worker.

| Data class | Candidate maximum/handling | Candidate purge and safeguards | Status |
| --- | --- | --- | --- |
| Active workforce access record | Active employment/assignment period | Local deny at offboarding; no automatic grant from a stale backup | `PROPOSED_CANDIDATE` |
| Inactive access record and subject mapping | 90 days after local deny | Purge subject digest by the deadline; retain only non-linkable audit actor where required | `PROPOSED_CANDIDATE` |
| OAuth state, nonce, and PKCE transaction | 10 minutes | Consume once; purge payload within one hour | `PROPOSED_CANDIDATE` |
| Privacy-minimized bootstrap security receipt | 30 days | No raw token, code, email, `sub`, state, nonce, PKCE, IP, or provider error body | `PROPOSED_CANDIDATE` |
| Bootstrap/operator session row | 10 minutes/four hours | Purge expired or revoked metadata within seven days | `PROPOSED_CANDIDATE` |
| WebAuthn challenge/action grant | Five minutes/60 seconds | Purge sensitive payload within one hour; minimal outcome receipt for 30 days | `PROPOSED_CANDIDATE` |
| Active credential public data | While actor is active | Revoke before replacement; general application role cannot read it | `PROPOSED_CANDIDATE` |
| Revoked credential public data | 30 days | Retain only a credential tombstone digest for 365 days to prevent accidental reuse | `PROPOSED_CANDIDATE` |
| Enrollment/recovery/security event | 180 days | Privacy-minimized event only; no credential material | `PROPOSED_CANDIDATE` |
| Expired GCRA bucket | TAT elapsed plus seven days | Hourly bounded cleanup; never delete a future TAT | `PROPOSED_CANDIDATE` |
| Open/reviewing report | Unselected; the 30-day unresolved threshold is a P0 gate-off escalation candidate, not a purge or automatic decision | No age-based purge; final acceptance stops until a bounded, independently approved resolution path exists | `UNSELECTED_STOP` |
| Terminal `PostReport` and moderation audit | Option A direction proposes 180 days after the later of terminal action and bounded appeal closure, but no exact bounded closure contract exists yet | No age-based purge; no raw UGC copy is created for restoration | `UNSELECTED_STOP`; exact notice/appeal clock, Privacy/Legal owner, purge authority, and overdue-case treatment are unresolved |
| Privacy-minimized logs and ordinary alerts | 30 days | Daily provider-side expiry | `PROPOSED_CANDIDATE` |
| Security incident record | 180 days after closure | Restricted incident store; not ordinary logs | `PROPOSED_CANDIDATE` |
| Encrypted database backup | 37-day hard maximum: 30-day rolling access window plus no more than seven days to physical purge | Disable restore access at day 30, prove physical purge by day 37, and run a quarterly restore drill | `PROPOSED_CANDIDATE` |

Legal hold candidate:

- Privacy/Legal and Security approve one case ID, data-class scope, reason
  category, owner, start, review date, and expiry;
- the initial hold is at most 90 days and requires review every 30 days;
- no automatic or indefinite hold is allowed;
- cumulative hold duration is at most 365 days unless a documented external
  legal obligation requires longer; that exception needs case-specific counsel
  and Security approval plus a fresh audited review every 30 days;
- release applies the ordinary policy within seven days; and
- raw UGC is not copied into a separate hold store merely to extend retention.

Reporter account deletion continues to set `reporterId=NULL` without a
replacement pseudonym. Before activation, the ordinary application database
role must be prohibited from hard-deleting `Post` or `PostReport`; exact target
privilege proof remains `EXTERNAL_PROOF_REQUIRED`.

## SLA and operating ownership

| Operating field | Exact candidate | Status |
| --- | --- | --- |
| First response SLA | 24 hours from `PostReport.createdAt` | `PROPOSED_CANDIDATE`; not a public commitment |
| Warning threshold | 18 hours | `PROPOSED_CANDIDATE` |
| Breach escalation | Page the named primary and backup at 24 hours | `PROPOSED_CANDIDATE` plus alert proof |
| Routine coverage | Daily 09:00–21:00 `Asia/Dubai`; queue checked at least every four hours | `PROPOSED_CANDIDATE` plus staffing proof |
| Security/offboarding coverage | 24/7 reachable roster for the 15-minute local-deny SLA | `PROPOSED_CANDIDATE` plus exercise receipt |
| Urgent-content classification/SLA | Unselected | Privacy/Legal and Product decision required |
| Appeal intake and closure | Option A direction: no original-content restoration; an upheld appeal records an overturn and permits a new compliant repost. Thirty days to file and 30 days to decide remain planning targets | `UNSELECTED_STOP`; exact recipient/outbox, unified clock, urgent-case treatment, independent reviewer, Privacy/Legal owner, and jurisdiction review are unresolved |

### Appeal Option A direction and remaining exact contract

Option A minimizes retained harmful content and matches the current destructive
`REMOVE_POST` behavior. The task-owner direction selects the
no-original-restoration, overturn-record, and new-compliant-repost model for
further design, with 30-day filing and 30-day decision periods as planning
targets. It does not select the exact operating clock, user-facing promise,
retention period, or implemented workflow.

Before final operating acceptance, one exact independently reviewed contract
must define all of the following together:

- a privacy-minimized notice recipient or inbox target created atomically
  before `REMOVE_POST` clears `Post.authorId`, with no raw email or UGC in the
  moderation audit and with bounded account-deletion/retention behavior;
- one coherent clock covering the latest notice-attempt time, successful and
  failed delivery, valid appeal receipt, decision start, tolling, breach
  escalation, and overdue records. Thirty-day filing and decision periods are
  starting candidates only; timeout must neither auto-deny an appeal nor purge
  an unresolved record;
- notice and appeal behavior for every removal, including any urgent class. An
  exception requires an independently approved Privacy/Legal basis rather than
  being inferred by an operator;
- a reviewer who did not make the original removal decision; self-review is
  prohibited;
- no retention or reconstruction of the removed body, media, or author link
  merely to make restoration possible; and
- an upheld result that appends a privacy-minimized overturn audit, notifies
  the user, and permits a new compliant repost without automatically
  republishing or claiming to restore the removed post.

The current schema and service have no appeal, overturn, notice-delivery, or
repost authorization state. Those additive contracts, user experience,
contact-channel ownership, legal exceptions, and purge behavior must be
designed and jointly accepted before source implementation. Implemented schema,
tests, privacy review, and exercises are later activation gates. Until then, no
operator may send an appeal notice, record an overturn, or restore/repost
content on a user's behalf.

## Nominated role mapping, not acceptance

Names in this table are candidate assignments only. No acceptance date,
durable contact path, on-call exercise, or ratification receipt is observed.

| Discipline | Nominated primary | Nominated backup | Status |
| --- | --- | --- | --- |
| Product | Seung Hyun Lee | Hy Jong Kang | Nominated; both acceptance receipts pending |
| Backend | Hy Jong Kang | `HUMAN_NAME_REQUIRED` third technical reviewer | Primary acceptance and qualified backup pending |
| Security | Hy Jong Kang | `HUMAN_NAME_REQUIRED` independent security backup | Primary acceptance and qualified backup pending |
| Privacy/Legal | `HUMAN_NAME_REQUIRED` | `HUMAN_NAME_REQUIRED` | No qualified reviewer nominated |
| Operations | Seung Hyun Lee | Hy Jong Kang | Nominated; both acceptance receipts pending |
| Moderation owner | Seung Hyun Lee | Hy Jong Kang | Nominated; acceptance, training, and independent-appeal handoff pending |

Hy Jong Kang and Seung Hyun Lee are distinct nominees for the Security and
Operations sides of a future genesis ceremony. That does not select or execute
the genesis design, and neither may approve their own credential, access
change, removal action, or appeal decision.

Every row below requires an actual person, backup, durable contact path, and
dated acceptance. A team name or job title alone is insufficient.

| Responsibility | Primary | Backup | Evidence/status |
| --- | --- | --- | --- |
| Google Cloud project, OAuth client, and Workspace policy | `HUMAN_NAME_REQUIRED` | `HUMAN_NAME_REQUIRED` | Pending |
| Opaque-session incident response and mass revocation | `HUMAN_NAME_REQUIRED` | `HUMAN_NAME_REQUIRED` | Pending |
| WebAuthn enrollment, recovery, and credential revocation | `HUMAN_NAME_REQUIRED` | `HUMAN_NAME_REQUIRED` | Pending |
| Operator security notifications and repudiation | `HUMAN_NAME_REQUIRED` | `HUMAN_NAME_REQUIRED` | Pending |
| Primary moderation queue and coverage | `HUMAN_NAME_REQUIRED` | `HUMAN_NAME_REQUIRED` | Pending |
| Security/auth escalation | `HUMAN_NAME_REQUIRED` | `HUMAN_NAME_REQUIRED` | Pending |
| Privacy/Legal and urgent-content escalation | `HUMAN_NAME_REQUIRED` | `HUMAN_NAME_REQUIRED` | Pending |
| User contact templates, sender, and channel | `HUMAN_NAME_REQUIRED` | `HUMAN_NAME_REQUIRED` | Pending |
| Appeal intake and independent review | `HUMAN_NAME_REQUIRED` | `HUMAN_NAME_REQUIRED` | Pending |
| SLA alerts and breach procedure | `HUMAN_NAME_REQUIRED` | `HUMAN_NAME_REQUIRED` | Pending |
| Per-post pending abuse/Sybil response | `HUMAN_NAME_REQUIRED` | `HUMAN_NAME_REQUIRED` | Pending |
| Database backup, restore, retention, and purge | `HUMAN_NAME_REQUIRED` | `HUMAN_NAME_REQUIRED` | Pending |

## Evidence and observability redaction

Ordinary HTTP logs, error tracking, traces, breadcrumbs, proxy logs, CI
artifacts, tickets, screenshots, and provider-proof receipts must not contain:

- `Authorization`, `Cookie`, or `Set-Cookie` values;
- authorization codes, ID/access/refresh tokens, or client secrets;
- raw or digested state, nonce, PKCE, session, CSRF, challenge, or action-grant
  values;
- WebAuthn credential IDs, user handles, public keys, attestations, assertions,
  or authenticator data;
- Google `sub`, email, name, picture, or full claims;
- reporter/author identity, wallet, post body, media, or other raw UGC;
- provider/SQL error bodies, query parameters, or IP addresses; or
- opaque actor, role, or capability values outside the restricted audit store.

The OAuth callback query contains `code` and `state`; proxy and application
access logs record only its normalized path. Callback responses use
`Cache-Control: no-store` and `Referrer-Policy: no-referrer` and include no
third-party resources. Audit records may contain the minimum opaque actor,
capability/action, report/post IDs and versions, policy version, result,
approver actor, and database UTC time required by the approved contract. They
never contain the authentication material above.

## Provider-proof checklist

A separate approval may run this checklist against a dedicated non-production
project and disposable identities. That approval does not authorize production
configuration or a real reviewer.

- [ ] Record the exact Google Cloud project ID/number, parent organization,
      named owners, and Workspace domain type without exposing secrets.
- [ ] Prove the app audience is `Internal`; prove an external account receives
      `org_internal`; keep an exact local disposable-subject allowlist.
- [ ] Record the exact public staging Web client ID and its fingerprint, exact
      callback, exact scope, and secret custodian. Never copy the client secret.
- [ ] Prove authorization code, PKCE `S256`, state, and nonce success plus
      mismatch, expiry, replay, wrong verifier, and reused-code rejection.
- [ ] Record value-safe ID-token evidence for signature, issuer, single
      audience, optional `azp`, `sub` stability by keyed digest, exact `hd`,
      `iat`, `exp`, nonce, algorithm, and header-type presence/absence.
- [ ] Prove exact discovery/JWKS URL, HTTPS, redirect refusal, cache behavior,
      key rotation, bounded document, and unknown-key fail-closed behavior.
- [ ] Prove no extra granted scope, offline access, or refresh token exists.
- [ ] Prove Google ID/access tokens cannot authenticate a moderation route.
- [ ] Prove staging DNS/TLS, exact origin/RP ID, same-origin routing, and direct
      Railway-origin bypass protection.
- [ ] Prove WebAuthn exact origin/RP/type/challenge/UP/UV/signature/credential
      ownership plus replay and concurrent-replay rejection.
- [ ] Record Workspace 2-Step Verification policy as defense-in-depth evidence;
      do not treat optional `auth_time` or `amr` as EasyGo WebAuthn proof.
- [ ] Purge raw codes, tokens, verifier, state, nonce, email, `sub`, assertion,
      and browser artifacts; record only value-safe receipts.

Any missing readback is `unobserved`, never a passing result.

## Candidate ratification record

Each decider first ratifies the same immutable candidate version as suitable
for a separately approved non-production proof. PR approval or merge alone
records the proposal and does not fill this table or run the proof.

| Discipline | Named decider | Ratification decision | Date | Evidence/meeting ID |
| --- | --- | --- | --- | --- |
| Product | Seung Hyun Lee (nominated) | Pending | Pending | Acceptance and meeting receipt pending |
| Backend | Hy Jong Kang (nominated) | Pending | Pending | Acceptance, backup, and meeting receipt pending |
| Security | Hy Jong Kang (nominated) | Pending | Pending | Acceptance, backup, and meeting receipt pending |
| Privacy/Legal | `HUMAN_NAME_REQUIRED` | Pending | Pending | Pending |
| Operations | Seung Hyun Lee (nominated) | Pending | Pending | Acceptance and meeting receipt pending |
| Moderation owner | Seung Hyun Lee (nominated) | Pending | Pending | Acceptance, training, and meeting receipt pending |

Ratification requires all rows to say `Ratified for proof` for the exact same
version. It authorizes neither provider changes nor proof execution without the
next separate approval.

## Final operating acceptance record

After the separately approved proof, every decider reviews the exact receipts,
resolved stop conditions, named owners, and any changed candidate. This second
table, not candidate ratification, selects operating values.

| Discipline | Named decider | Final decision | Date | Proof/meeting ID |
| --- | --- | --- | --- | --- |
| Product | `HUMAN_NAME_REQUIRED` | Pending | Pending | Pending |
| Backend | `HUMAN_NAME_REQUIRED` | Pending | Pending | Pending |
| Security | `HUMAN_NAME_REQUIRED` | Pending | Pending | Pending |
| Privacy/Legal | `HUMAN_NAME_REQUIRED` | Pending | Pending | Pending |
| Operations | `HUMAN_NAME_REQUIRED` | Pending | Pending | Pending |
| Moderation owner | `HUMAN_NAME_REQUIRED` | Pending | Pending | Pending |

Final acceptance requires all rows to say `Approved` for the exact same
version. A rejection, failed proof, or requested change produces a new
candidate version and a new ratification/proof cycle; it does not edit an
accepted record in place.

## Stop conditions and next gates

Stop before non-production proof unless candidate ratification is complete and
proof execution is separately approved. Stop before implementation when any
external proof, `UNSELECTED_STOP`, human owner, retention decision, rate
threshold, or final operating acceptance is incomplete. Stop when the team
cannot operate independent enrollment/recovery or local-first mass revocation;
reconsider a managed workforce broker rather than weakening the contract.

After this documentation PR, every later step remains separately approved:

1. candidate ratification for one immutable version;
2. non-production Google and WebAuthn provider-proof execution;
3. final joint operating acceptance of the proven values and named owners;
4. source-latch-off data contracts and disposable-database tests;
5. dormant Google bootstrap, opaque-session, access, and WebAuthn code;
6. independent security/browser/concurrency review;
7. staging migration and gate-off deployment;
8. source singleton/latch change while the runtime gate remains false;
9. controlled staging flag-on QA followed by flag closure;
10. production target proof and gate-off deployment; and
11. final production activation with an exact first-action audit receipt.

No earlier result authorizes a later step.

## References

- [ADR-0011: Protected post-report moderation](./adr/0011-protected-post-report-moderation.md)
- [ADR-0012: Workforce OIDC and actor limits](./adr/0012-workforce-oidc-and-actor-rate-limits.md)
- [ADR-0013: PostgreSQL GCRA](./adr/0013-postgresql-gcra-moderation-rate-limits.md)
- [ADR-0014: Moderation operating-policy selection](./adr/0014-moderation-operating-policy-selection.md)
- [Moderation runbook](./MODERATION_RUNBOOK.md)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google OIDC claims reference](https://developers.google.com/identity/openid-connect/reference)
- [Google app audience](https://support.google.com/cloud/answer/15549945)
- [Google Security Bundle](https://developers.google.com/identity/siwg/security-bundle)
- [Google discovery document](https://accounts.google.com/.well-known/openid-configuration)
- [Web Authentication Level 3](https://www.w3.org/TR/webauthn-3/)
- [OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)
