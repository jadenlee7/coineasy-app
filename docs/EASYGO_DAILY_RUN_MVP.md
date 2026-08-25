# EasyGo Daily Run MVP

## Product promise

**매일 약 3분, 밈으로 Web3 하나를 이해하고 안전하게 직접 해본다.**

Daily Run turns EasyGo's existing wallet, education, safety, and read-only
Base experiences into one repeatable loop:

`Meme -> Learn -> Quiz -> Safe practice -> Knowledge XP`

The MVP optimizes for a clear first success and a reason to return tomorrow,
not infinite scrolling or time spent.

## Entry points

- Signed out: the EasyGo login hero exposes a **30초 맛보기**. It contains one
  Meme/Learn/Quiz sample, writes no account data, and grants no reward.
- Signed in: Home exposes **Today's EasyGo Run** above the feed.
- One new lesson can be completed per local calendar date. Reopening the Run
  shows that date's completion; the next lesson opens on the next date.

## Seven-day starter curriculum

| Day | Badge | Concept | Safe practice |
| --- | --- | --- | --- |
| 1 | Wallet Rookie | A wallet manages keys, not coin files | Attest the signed-in Privy Base wallet |
| 2 | Base Explorer | A block explorer is a public receipt search | Open the user's own address on BaseScan |
| 3 | Scam Shield | Never share a seed phrase or private key | Identify a malicious seed-phrase link |
| 4 | Gas Navigator | Gas pays for network computation | Identify Base mainnet chain ID `8453` |
| 5 | Stablecoin Spotter | Price-stable design is not zero risk | Distinguish USDC from ETH and local XP |
| 6 | Quote Reader | A quote is not an executed trade | Open the display-only Base quote preview |
| 7 | Web3 Guide | Explain one concept without hype | Choose a safe one-sentence explanation |

The optional Day 7 system share sheet appears only after completion. Sharing,
posting, inviting a friend, and external activity never gate progress or XP.

## Reward model

- The MVP grants local **Knowledge XP** only.
- XP is non-purchasable, non-transferable, non-redeemable, and has no cash or
  token representation.
- Daily Run does not call an Orange claim, swap log, transaction, signing, or
  broadcast API.
- XP is derived from known one-time lesson completions. A stored total cannot
  inflate it.

## Account ownership and idempotency

`dailyRunProgress` is a new allowlisted slot in the hashed owner-scoped device
store. It uses the current Privy account lease and therefore:

- never imports unscoped legacy data;
- cannot write through an old session epoch;
- is separate for Apple and Google accounts;
- is deleted by the existing owner purge used by account deletion;
- grants one lesson's XP once, even if completion is retried;
- blocks a second new lesson on the same local date.

No wallet address or Privy DID is embedded in the AsyncStorage key.

## Safety boundaries

- Day 1 reads the current embedded wallet and Base chain attestation.
- Day 2 opens a public BaseScan URL for the signed-in user's own address.
- Day 6 may navigate to the existing quote preview. The preview remains
  display-only: no transaction request, calldata, signing, or broadcast.
- Completing or sharing a Run never produces Orange or an onchain reward.
- Guest progress never migrates into an authenticated account.

The App Store candidate must also include the separate App Store hardening
change that removes the legacy dormant Squid execution module from the mobile
bundle. Daily Run's feature-level no-execution boundary is not, by itself,
bundle-level release evidence.

## Focused QA

Automated:

1. Curriculum remains seven ordered lessons with Meme/Learn/Quiz/Do content.
2. First completion records the exact known XP.
3. Duplicate completion is idempotent.
4. A second lesson on the same date is rejected.
5. Out-of-order completion is rejected.
6. Consecutive dates grow streak; a missed date resets it.
7. Unknown stored lessons and forged XP totals are ignored.
8. The storage slot is owner-scoped and uses the render lease.

Physical device:

1. Signed-out sample closes back to Login and saves no progress.
2. Day 1 sees `Base · 준비 완료` for the signed-in wallet.
3. Background/foreground during a Run retains only in-memory screen state and
   does not complete the lesson early.
4. Day 2 opens the correct own-address BaseScan page.
5. Day 6 opens preview-only UI and returning allows the user to finish.
6. Completing twice on one date does not add XP.
7. Apple -> Google -> Apple shows isolated progress for each account.
8. Account deletion purges local Daily Run progress with other owner data.
9. Day 7 completion works without opening or completing the share sheet.
10. A Run left open across local midnight refreshes to the new date before it
    can record progress.

## Explicit non-goals

- No telemetry SDK or external event delivery in this MVP.
- No Orange minting or claiming.
- No social-post or invite reward.
- No swap execution.
- No server leaderboard, friends competition, or paid streak repair.
- No curriculum CMS or remote content activation.

These can be evaluated only after physical-device QA and an approved privacy,
moderation, and reward policy.
