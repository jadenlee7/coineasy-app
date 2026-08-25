# EasyGo legal-document and consent release gate

Status: **staging candidate; operator and qualified legal approval required**

Candidate version: `2026-08-10-staging-v1`

Prepared: 2026-08-10

This file records a technical/compliance review and is not legal advice. The
candidate documents deliberately keep new consent grants and every optional
Path C processor disabled until the facts below are confirmed.

## Candidate URLs after the matching backend is deployed

- Manifest:
  `https://easygo-web-staging-staging.up.railway.app/legal/manifest.json`
- Privacy:
  `https://easygo-web-staging-staging.up.railway.app/legal/2026-08-10-staging-v1/privacy`
- Terms:
  `https://easygo-web-staging-staging.up.railway.app/legal/2026-08-10-staging-v1/terms`

The manifest must report `status=staging_candidate` and
`publishedForConsent=false`. Both HTML responses use `noindex, nofollow` while
they remain review copies. They must not be entered as production App Store or
Google Play policy URLs in this state.

## Authoritative requirements checked

- [Apple App Review Guidelines 5.1.1](https://developer.apple.com/app-store/review/guidelines/#privacy)
  require an accessible in-app and App Store Connect privacy link that
  identifies collection, use, third-party handling, retention/deletion, consent
  withdrawal, and deletion requests.
- [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
  requires apps with account creation to initiate deletion in-app, remove
  associated data except disclosed legal retention, and revoke Sign in with
  Apple tokens where applicable.
- [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)
  requires accurate privacy and Data safety disclosures for collected, used,
  and shared personal or sensitive data.
- [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
  require both an in-app path and a functional web resource that can initiate
  account and associated-data deletion without reinstalling the app.
- The Korean Personal Information Protection Commission's
  [2026 privacy-policy drafting guide](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=&nttId=12018)
  is the current drafting reference for transparent publication under Korean
  privacy law.

## Product facts represented in the candidate

- Operator inherited from the existing company documents: The Pivot Co., Ltd.
- Contact inherited from the existing terms: `contact@coineasy.xyz`.
- EasyGo processes a Privy account identifier, provider login linkage, private
  profile data, public social content, a public EVM wallet address, Base chain
  verification, Orange and swap records, consent/audit records, and optional
  quest/segment data. Authenticated post reports are retained as bounded
  moderation records and the reporter identity is not shown to the reported
  user.
- EasyGo never requests or stores a wallet private key or recovery phrase.
- Other users' wallet addresses are excluded from public EasyGo profile
  responses. Public blockchain records remain independently public and
  immutable.
- Expo push tokens are currently generated only after device permission and
  retained in the account-scoped on-device store. The owner-bound backend
  registration implementation is compile-time locked; it must not activate
  until a new versioned privacy document describes server storage and matching
  physical-device QA passes. Remote notification sending is not active.
- Media selection uses device permissions only on user action. The EasyGo
  backend media-upload flow remains disabled.
- Privy, Apple, Google, Railway/PostgreSQL, Expo, Squid and Base infrastructure
  are named. JustaName/ENS, Etherscan, EFP, Sentry, Better Stack and Telegram
  are disclosed as conditional, separately gated providers.
- Personalized segmentation, marketing measurement, advertiser activation,
  quests, ENS issuance, SIWE, telemetry, and public account deletion remain
  default-off.
- The App Store mobile graph has no Ad/Invite reward, Shop, Gift, redemption,
  or asset-conversion surface and no Squid signing, broadcast, execution-quote,
  or reward-log client. Visible Orange copy describes non-purchasable,
  non-transferable, non-redeemable in-app progress points only. The educational
  Base Route Estimate Lab under EASYEDU requests a display-only estimate and
  cannot award Orange.

## Required configuration contract

The next staging mobile artifact must use exactly:

```env
EXPO_PUBLIC_EASYGO_CONSENT_VERSION=2026-08-10-staging-v1
EXPO_PUBLIC_EASYGO_PRIVACY_URL=https://easygo-web-staging-staging.up.railway.app/legal/2026-08-10-staging-v1/privacy
EXPO_PUBLIC_EASYGO_TERMS_URL=https://easygo-web-staging-staging.up.railway.app/legal/2026-08-10-staging-v1/terms
```

The staging web service must use:

```env
EASYGO_CONSENT_VERSION=2026-08-10-staging-v1
CONSENT_GRANTS_ENABLED=false
```

Mobile staging preflight rejects missing, insecure, same, or version-mismatched
document URLs. Backend staging preflight rejects a server version that differs
from the bundled candidate. It also rejects `CONSENT_GRANTS_ENABLED=true` while
the bundled document status is not `approved`.

On 2026-08-11, the three mobile values above were added as public variables to
the EAS `preview` environment only. The `production` environment was not given
the candidate legal values. An EAS-preview-injected staging preflight passed
with zero failures before preparing Build 103.

`GET /me/consent` now returns `consent.grantsEnabled`. New clients treat a
missing field as `false`, so a backend/mobile rolling deployment remains
fail-closed. Revocation remains available independently of the grant gate.

## Approval blockers

- [ ] Confirm The Pivot Co., Ltd.'s exact registered name, registered/business
      address, country of establishment, and the jurisdictions where EasyGo
      will launch.
- [ ] Appoint or confirm the privacy officer/team name, title, email, and any
      locally required telephone contact.
- [ ] Approve a processor and cross-border transfer table with exact legal
      entities, purposes, data categories, processing countries, safeguards,
      contracts, and retention/deletion commitments.
- [ ] Approve exact retention schedules for active accounts, security/request
      logs, backups, deleted post topology, consent audits, reward/transaction
      records, and keyed deletion tombstones.
- [ ] Approve the Orange/quest promotional rules and confirm that Orange has no
      cash, deposit, security, cryptoasset, transfer, conversion, or redemption
      status. Reconcile the daily social-participation progress design with
      [App Review Guideline 3.1.5(v)](https://developer.apple.com/app-store/review/guidelines/#cryptocurrencies),
      which prohibits cryptocurrency apps from offering currency for tasks
      such as social posting. If qualified review cannot establish that the
      non-transferable progress points are outside that rule, disable the daily
      participation claim before App Store submission.
- [ ] Keep all four account-deletion source latches and all three runtime flags
      closed until the provider-neutral path is complete. The current native
      Apple reauth discards the authorization code, has no reviewed token
      exchange/revocation credential, and its cleanup disposition is
      intentionally unimplemented. Google stable identity, recent reauth,
      provider cleanup, Android coverage, and the standalone web initiation
      path are also absent. Verify every stage on disposable staging accounts
      before a separate activation review.
- [ ] Operate the new authenticated, deduplicated post-report persistence with
      a separately protected moderation queue, assigned reviewer, response
      SLA, action/status workflow, user contact/escalation path, and reviewed
      retention schedule. Persistence alone does not close App Review
      Guideline 1.2.
- [ ] Reconcile Apple App Privacy and Google Play Data safety answers with the
      final document and an SDK/data-flow inventory.
- [ ] Obtain qualified legal review for privacy, consumer, UGC moderation,
      crypto/Web3, sanctions/export, minors, governing-law and liability terms
      in every launch jurisdiction.
- [ ] Replace `staging_candidate` with `approved`, set the final effective
      version, remove the review banner/noindex response, deploy, and validate
      the production URLs before enabling consent grants.

## Staging verification after an approved deployment

- [x] `/legal/manifest.json` reports the exact deployed candidate and no secret.
- [x] Privacy and terms return HTTP 200, HTML UTF-8, CSP, no-referrer, nosniff,
      and the exact version in visible copy and metadata.
- [x] Login and Settings open the configured EasyGo URLs, never the legacy
      Google Drive documents.
- [x] Settings shows the matching server version but clearly states that new
      consent remains review-locked.
- [ ] A new grant attempt cannot be sent by the UI and is rejected server-side.
- [ ] An existing consent can still be fully revoked.
- [x] No optional Path C worker or provider is activated.

On 2026-08-11, Railway staging deployment
`85a4937a-41db-4f85-97f5-3831474437f3` reached `SUCCESS` from exact merged
release `5372bfcd424d8fb071a5c5022f43d33a61d32f05`. `/health`, `/ready`, and
`/social/status` returned HTTP 200. The manifest returned
`status=staging_candidate`, `publishedForConsent=false`, and exact version
`2026-08-10-staging-v1`; both HTML documents returned HTTP 200 with the
required review and security headers. Deployment and HTTP logs contained no
application error or 5xx response during the check. `CONSENT_GRANTS_ENABLED`
and every optional Path C web flag remained `false` or unset; the dormant
worker also kept its optional flags `false` or unset.

The owner then passed a Build 102 cold-start and Apple sign-out/sign-in
regression against this backend, including profile, Orange balance, feed, and
Settings navigation without a crash or login loop. Build 102 predates the
matching mobile legal-URL configuration, so this result does not complete the
unchecked next-artifact URL, grant-rejection, or revocation checks above.

On 2026-08-11, internal-only Build 103 completed from exact release commit
`c8732b1c67b3bedade78fe057d7907221bc057f8`. EAS build
`f2a3aa79-31bb-41e7-b9de-fdf573422c6d` and submission
`90463ef8-67ad-40bb-8570-bb91b2d58794` finished successfully; App Store Connect
build `37314fb9-8f11-4dcb-adf3-ea509ff920a7` is `VALID`,
`buildAudienceType=INTERNAL_ONLY`, and unavailable to external testing. The
owner installed it from TestFlight, completed Sign in with Apple, confirmed the
matching server version and review lock in Settings, and opened both matching
versioned EasyGo documents without a crash, login loop, or legacy Google Drive
fallback. Server-side grant rejection and existing-consent revocation remain
separate unchecked gates above.

Later on 2026-08-11, a non-mutating Railway staging check reconfirmed
`CONSENT_GRANTS_ENABLED=false`, exact consent version
`2026-08-10-staging-v1`, and every deletion or optional Path C latch as false
or unset. The deployed consent module classified a new grant as adding
permission while classifying an all-false replacement as a revocation; the
grant capability remained disabled. `/health`, `/ready`, and the legal manifest
returned HTTP 200, while unauthenticated `GET` and `PUT /me/consent` requests
both returned `401 missing_bearer`. A privacy-preserving aggregate found no
consent rows in staging, so no existing user consent was created or altered and
the real authenticated grant-rejection and revocation checks remain unchecked.
The complete mobile suite passed 156/156; the backend suite passed 215 tests
with its two PostgreSQL-only integration cases skipped by the local harness.

The owner then completed the remaining Build 103 account regression on the
physical iPhone. The same profile, `100` Orange balance, feed, and locked policy
state survived sign-out and a fresh Sign in with Apple. Both full and social
JSON exports opened the iOS share sheet. Privacy-minimized Railway HTTP
evidence recorded one successful `GET /me/data` and one successful
`GET /me/social-export`, alongside successful auth sync, consent, Orange, and
feed/post requests; the checked window contained no `401`, 5xx, or application
error log. This does not change the two consent mutation gates above, which
remain unchecked until a designated authenticated staging account has suitable
consent state.
