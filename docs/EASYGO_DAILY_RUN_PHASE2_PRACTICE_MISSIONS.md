# EasyGo Daily Run Phase 2 — Practice Missions

- **Status:** Local fun-test implementation
- **Runtime activation:** Not deployed
- **Version:** 1
- **Depends on:** Daily Run completion crash fix PR #83

## Problem statement

The seven-day Daily Run teaches one Web3 concept at a time, but a correct
multiple-choice answer does not prove that a beginner can recognize the same
signal inside a realistic screen. Phase 2 needs a faster, more visual practice
loop that feels like a game while remaining impossible to sign, send, spend, or
move assets.

## Product promise

**실전 전에, 3분 동안 게임으로 영수증·사기·견적의 핵심 신호를 찾는다.**

The first release is a local fun test, not a progression or reward system. All
three missions are immediately available from an authenticated Daily Run
completion screen. Closing the Practice Arcade clears every score and answer.

## Goals

1. A first-time user can make the first move without additional instructions.
2. Each mission completes in 45–90 seconds on a physical device.
3. The three missions use visibly different interactions instead of repeating
   the existing Daily Run quiz.
4. At least two missions earn a “다시 하고 싶다” response before Weekly
   Onchain Boss implementation begins.
5. No mission can call a wallet, quote service, signing primitive, transaction,
   backend, storage, Orange reward, or external link.

## Explicit non-goals

- No actual live market data or Squid quote request.
- No signature, transaction, calldata, smart-contract call, or broadcast.
- No Knowledge XP, Orange, token, NFT, leaderboard, or transferable reward.
- No persistence, telemetry, account-scoped storage, API, or database schema.
- No Weekly Onchain Boss route or code in this phase.
- No App Store, EAS, Railway, or feature-flag activation.

## Mission design

| Mission | Primary gesture | Three-round learning arc | Session feedback |
| --- | --- | --- | --- |
| Receipt Detective | Tap a receipt field | Failed status → wrong network → recipient mismatch | Case closed, combo points |
| Scam Shield Duel | Choose the safest first response | Seed request → urgent approval link → public hash boundary | Shield hearts, block combo |
| Live Quote Boss | Tap a quote weakness | Expiry → price impact → minimum received | Boss health, soft countdown |

### Receipt Detective

The player taps directly on receipt fields instead of answering a detached
quiz. The game teaches a repeatable scan order: `Status → Network → To`.
Receipt addresses, values, and hashes are fixed fictional training data.

### Scam Shield Duel

The player sees a fixed bot message and chooses a blocking or verification
response. Wrong answers remove a training shield heart but never cause a game
over. No button reports, blocks, opens a URL, or interacts with a real user.

### Live Quote Boss

The name describes the countdown presentation, not the data source. Every
screen permanently labels the content:

`PRACTICE SNAPSHOT · NOT LIVE MARKET DATA`

`고정 연습 데이터 · 실제 가격/견적 아님 · 서명·전송·자산 이동 없음`

The numbers are immutable local fixtures. The countdown is soft pressure only;
it is labelled as a separate bonus timer, never changes quote expiry or score,
and never enables execution. There is no Accept, Confirm, Swap, Sign, or Send
control. Boss health falls only after a correct hit.

## Reward and failure model

- Correct first tap: 100 points plus a 25-point combo increment.
- Wrong first tap: 0 points, combo reset, one training heart removed.
- The player always continues after reading the explanation.
- Mission result: 1–3 local session stars based on first-try accuracy.
- An incomplete mission earns zero stars.
- Results are not persisted and do not change Daily Run XP, streak, completion,
  Orange, wallet state, or account data.

## Architecture decision

Static content lives in `data/practiceMissions.mjs`. A React-free state machine
in `utils/dailyRunPracticeEngine.mjs` rejects invalid choices, duplicate taps,
skipped rounds, and input after completion. The screen owns a single in-memory
session and discards it when unmounted. `DailyRunPracticeMissions` imports no
wallet, API, provider, storage, link, clipboard, or web-view module.

The feature branch is stacked on PR #83 because both changes touch the Daily
Run completion surface and the older confetti dependency crashes that exact
path in Build 111. Before a future merge, PR #83 must land and this branch must
be updated onto the resulting `master`.

## Fun-test gate

### Founder smoke

- Play each mission three times.
- On the second play, finish without reading instructions again.
- Identify at least one mission worth replaying immediately.
- Observe zero crash, frozen control, wallet prompt, network request, or stale
  result after leaving and reopening the screen.

### Beginner playtest

Use a manual QA sheet; this phase has no telemetry.

| Measure | Pass threshold |
| --- | --- |
| Participants | At least 5 Web3 beginners |
| Help-free completion | At least 80% |
| Median time per mission | 45–90 seconds |
| Immediate replay | At least 60% replay one mission |
| Fun score | Average at least 4/5; no mission below 3.5 |
| Exit after wrong answer | Below 20% |
| Safety comprehension | At least 80% on receipt/scam/quote checks |
| Runtime safety | 0 wallet prompts, signatures, sends, quote requests, asset moves |

Ask each tester three closing questions:

1. Which mission would you play again first, and why?
2. What did you check first in the receipt, message, or quote?
3. Was it clear that nothing real was signed, sent, blocked, or traded?

Weekly Onchain Boss remains blocked until these criteria pass and the team
chooses the strongest interaction as its central mechanic.

## Acceptance criteria

- All three mission cards are immediately open after an authenticated Daily
  Run completion or seven-day journey completion.
- Guest sample users never see the Practice Arcade entry point.
- Each mission has exactly three rounds and one correct answer per round.
- Fast duplicate taps cannot award points twice.
- Invalid IDs and out-of-order advance attempts fail closed.
- Correct and incorrect feedback uses text and icons, not color alone.
- Closing and reopening starts a clean session.
- Existing seven-day curriculum, completion, XP, streak, and account storage
  behavior remain unchanged.
- Automated source guards prove the Practice Arcade contains no execution,
  wallet, API, persistence, or external-navigation capability.
