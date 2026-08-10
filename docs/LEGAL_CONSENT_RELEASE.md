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
  quest/segment data.
- EasyGo never requests or stores a wallet private key or recovery phrase.
- Other users' wallet addresses are excluded from public EasyGo profile
  responses. Public blockchain records remain independently public and
  immutable.
- Expo push tokens are currently generated only after device permission and
  retained in the account-scoped on-device store; backend token registration
  has not shipped.
- Media selection uses device permissions only on user action. The EasyGo
  backend media-upload flow remains disabled.
- Privy, Apple, Google, Railway/PostgreSQL, Expo, Squid and Base infrastructure
  are named. JustaName/ENS, Etherscan, EFP, Sentry, Better Stack and Telegram
  are disclosed as conditional, separately gated providers.
- Personalized segmentation, marketing measurement, advertiser activation,
  quests, ENS issuance, SIWE, telemetry, and public account deletion remain
  default-off.

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
      cash, deposit, security, cryptoasset, or redemption status unless a
      specific campaign says otherwise.
- [ ] Complete the in-app account deletion path, provider cleanup, Sign in with
      Apple token revocation, Google/Android coverage, and a standalone web
      deletion request path on disposable staging accounts.
- [ ] Reconcile Apple App Privacy and Google Play Data safety answers with the
      final document and an SDK/data-flow inventory.
- [ ] Obtain qualified legal review for privacy, consumer, UGC moderation,
      crypto/Web3, sanctions/export, minors, governing-law and liability terms
      in every launch jurisdiction.
- [ ] Replace `staging_candidate` with `approved`, set the final effective
      version, remove the review banner/noindex response, deploy, and validate
      the production URLs before enabling consent grants.

## Staging verification after an approved deployment

- [ ] `/legal/manifest.json` reports the exact deployed candidate and no secret.
- [ ] Privacy and terms return HTTP 200, HTML UTF-8, CSP, no-referrer, nosniff,
      and the exact version in visible copy and metadata.
- [ ] Login and Settings open the configured EasyGo URLs, never the legacy
      Google Drive documents.
- [ ] Settings shows the matching server version but clearly states that new
      consent remains review-locked.
- [ ] A new grant attempt cannot be sent by the UI and is rejected server-side.
- [ ] An existing consent can still be fully revoked.
- [ ] No optional Path C worker or provider is activated.
