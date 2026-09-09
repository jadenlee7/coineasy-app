# Case Files — explicit quest completion

Local candidate, 2026-09-07. Founder feedback on Build 114: the scenarios feel
open-ended and players cannot tell when they are finished. This change makes
the objective, remaining work and terminal outcome explicit. It does not claim
to improve retention before a playtest.

Branch: `agent/easygo-case-files-quests`
Baseline: Build 114 source `bb881a18791b9a57d721c138360ed1f4e7d178af`.
Build number remains 114; these edits are **not** in the installed TestFlight
binary. Packaging these 15 candidate files through stage/commit/push and a Draft
PR was explicitly approved on 2026-09-09. Merge, new EAS build/submission,
Railway and DB operations are not included. Review and test observations below
are dated checkpoints, not evidence of deployment.

## Player flow

1. Catalog: three quests, completed/pending labels, and one start/continue CTA.
2. Quest: a visible progress bar, current instruction and evidence-derived
   checklist. A button takes the player to the tab for the next unfinished task.
3. Receipt: Status and Network explicitly say to tap them. Both full addresses
   must be expanded; evidence checks cannot be earned by navigating alone.
4. Finish: investigation needs all evidence and the correct network/verdict.
   Delivery needs the reviewed virtual transfer **and** receipt checks.
   The completion/verdict CTA stays disabled until the required evidence exists.
5. A dedicated completion screen replaces the working panes immediately. It
   shows a completion seal, completed count, outcome, takeaway and next action.
   Native success haptic / accessibility announcement are best-effort.
6. After all three, show “퀘스트 3개 모두 완료!” and “연습 마치기”.
   Never cycle automatically back to Case 1. Replay and receipt inspection are
   optional; receipt inspection includes a return-to-completion action.

Completion remains session-only, matching the existing architecture. Catalog
navigation preserves stamps; closing/blurring Case Files clears them. This
limitation is disclosed in the UI. Persistent progress is not added implicitly.

## Logo scope

Replace generic provider placeholders within Case Files with original,
locally bundled USDC, Base and Ethereum assets on network/token selectors,
request cards, balance rows, gas rows, review and receipts. Source URLs and
SHA-256 values are in [brand provenance](../assets/brands/SOURCES.md).
EasyGo-owned wallet/explorer headers reuse the EasyGo app logo; they are not
mislabelled as MetaMask, Coinbase Wallet or BaseScan. Character avatars and
navigation/action icons remain interface artwork, not provider marks.

Keep “연습 모드 · 가상 자산” on every screen, plus explicit fake-receipt and
no-affiliation wording. No runtime asset fetch, SDK connection, external link,
real signing, broadcast, Squid execution, Orange reward or storage is introduced.
W0 stays disabled and app dependency files are unchanged.

## Verification

- Mobile suite: **326/326 passed**, including all three cases × three authored
  variants, incomplete evidence, wrong verdict, progress guidance, terminal
  summary, deduplicated stamps, unchanged stale-review/double-confirm guards,
  no network/signing/storage capability, and original asset hashes.
- Local preflight: **0 failures, 6 warnings** with public Privy IDs supplied to
  the process. Warnings are the unconfigured clean-checkout backend/support/
  legal values and native allowlist reminder; this is not deployment readiness.
- Local iOS export and App Store bundle guard passed. No IPA/EAS build created.
- Actual screen + engine rendered through a local React Native Web harness:
  completed quests 1 → 2 → 3; rejected the wrong address verdict; verified
  evidence-gated buttons; double-clicked virtual transfer and observed exactly
  50 → 38 USDC, recipient 12 USDC and ETH 0.001000 → 0.000998.
  Delivery stayed unfinished until receipt evidence and the finish action.
- Dedicated 1/3, 2/3 and 3/3 completion screens observed; 3/3 has an explicit
  exit instead of a cyclic next-case action. Completed receipt inspection and
  its return action are present. 320px receipt shows wrapped full addresses and
  reachable completion CTA; 390px completion is readable.
- Browser screenshots: task-local `artifacts/case-files-quests/` (outside git).
  Preview substitutes native icons, haptics, safe areas and navigation, so it
  is not physical-device evidence. Preview dependencies live under /tmp only.

## Remaining device QA

- Update a separately approved TestFlight build, then verify the exact version.
- Complete each quest without a verbal walkthrough: can the player state the
  next step and recognize the end? Record one confusing point and favorite quest.
- iPhone safe areas, keyboard, large text, VoiceOver completion announcement,
  success haptic, background/lock during review, account switch and reopening.
- Ensure no actual wallet prompt, transaction, reward or prior-account state.
- Public asset-use review and all release approvals remain separate.

## CoinEasy branding continuation — 2026-09-07

The user supplied EasyTree Moodboard v2 / node `30509:6`. Figma design context
and screenshot identify the exact `oranges3 3` pixel-orange asset. The original
PNG is bundled locally and used for quest identity and the completion seal.
See [source and hash](../assets/brands/SOURCES.md#coineasy-pixel-orange).

Reuse the existing app-loaded Gmarket Bold/Medium fonts and Practice Arcade
orange/cream/ink palette, with bordered sticker-like cards and buttons. Full
addresses keep monospace. Provider logos keep their original colors and bytes.
No Figma document changes, runtime asset fetch, new font/dependency, build
number change or release action. The new orange is decorative, not an Orange
reward. Progress and safety rules are unchanged.

Post-branding checks: 327 mobile tests pass; local iOS export includes 2,702
modules / 130 assets and the bundle guard passes. The browser preview loads
the existing Gmarket font files, verifies the first quest's evidence/finish/
next flow, and captures catalog and completion at 390px plus completion at
320px. No browser errors observed. 320px result uses vertical scrolling to
reach lower actions; device large-text/VoiceOver/keyboard checks remain pending.
Screenshots: `branded-catalog-390.png`, `branded-complete-390.png`,
`branded-complete-320.png` in the task-local artifact folder.

## Immediate action feedback — 2026-09-07

Keep the learning loop short: action → factual result → next instruction.
`caseQuestFeedback.mjs` decorates engine transitions; it does not award points,
alter evidence, advance phases, introduce timers or persist anything.

- Request opened: “친구 요청 확인!” with the authored amount and network.
- New receipt evidence: “처리 상태 확인!” / “네트워크 확인!” /
  “전체 주소 대조!” and an incremental 1/3 → 3/3 clue count.
- Network changed: exact displayed USDC balance; explicitly says no assets moved.
- Valid review: “전송 전 점검 통과!” and “아직 보내지 않았어요”.
- Virtual transfer: “가상 전송 성공!” plus the remaining receipt step. Sending
  alone is not quest completion; balances change only once even on a double tap.
- Incorrect input/verdict: a specific correction without losing prior evidence.
- Completion remains a dedicated result screen with the actual takeaway and
  session-only stamp; it is not an endless reward or automatic replay loop.

Feedback stays above the scrollable work area, alongside the progress and next
instruction. New successes pulse the original orange for 210ms without blocking
input. Reduced motion defaults ON until the OS preference is read and suppresses
the animation when requested. Android gets a polite live region; iOS uses an
accessibility announcement. Duplicate evidence taps do not retrigger feedback;
editing or invalidating a review cannot leave a stale approval message.

Verification: **333/333 mobile tests pass**, including six feedback tests for
request/evidence repetition, balance accuracy, stale review, double confirmation,
wrong verdict recovery and inert inputs. Local iOS export and bundle guard pass.
Local actual-screen browser checks observed all three clue messages, exact Base
balance discovery and reachable completion at 320px, input-error recovery,
review-before-send, and a double-clicked transfer leaving 38 USDC / recipient
12 USDC rather than sending twice. No browser errors observed. Screenshots:
`feedback-clue-390.png`, `feedback-balance-320.png`, `feedback-delivery-390.png`.

Native reduced-motion, VoiceOver announcement timing, haptic and large-text
behavior remain device QA, not browser-proven. Engagement/fun and perceived
response speed need playtesting; no retention or latency outcome is claimed.
No stage, commit, push, PR, merge, EAS/TestFlight, Railway or DB action in this
continuation. These changes are not in the already installed Build 114.

## Pre-PR review — 2026-09-09

Reviewed the local 15-file candidate for completion correctness, stale feedback,
resource cleanup, offline boundaries and asset provenance. Found and fixed one
completion-copy regression: after finishing the delivery quest, reopening its
receipt and switching to the wallet still said the quest was unfinished. The
wallet now uses the evidence-derived progress model's delivery message, so
`sent` asks for receipt confirmation while `complete` stays explicitly complete.

Added regression coverage for all three delivery variants, including receipt
reopening and network switching after completion. A separate differential test
compares the feedback wrapper with the undecorated engine across nine authored
completion paths and 2,700 deterministic mixed events: state, balances and prior
state immutability match, excluding feedback metadata only.

Current local evidence: **335/335 tests pass**, JSX transform passes,
`git diff --check` passes, local preflight has 0 failures / 6 previously listed
configuration warnings, and the fresh iOS export / App Store bundle guard pass.
Bundle: `entrypoint-5472fd90bb2e2fb1d60f26c5b4a6d279.js`. Existing 2026-09-07
browser screenshots above predate this copy-only fix; no new browser or native
device observation is claimed in this review. The temporary preview harness
from that session is no longer present. Native QA and asset-use review remain
required before release. Fun/clarity must still be checked with players.

No other blocking issue found in this local review; this is not CI, independent
review, merge, build or release approval. At this review checkpoint, base HEAD was
`bb881a18791b9a57d721c138360ed1f4e7d178af`, iOS buildNumber 114 / Android versionCode
65 were unchanged, and the candidate was uncommitted. A local PR summary was
prepared outside the repository. Subsequent 2026-09-09 approval covers only the
15 candidate files and stage/commit/push/Draft PR; CI and PR receipts belong in
the resulting PR, with release approval still separate.
