# Squid Korea AMA · Bot Runbook

## TL;DR

- **AMA:** Wednesday, 5 August 2026
- **Time:** 11:00–11:30 UTC / 12:00–12:30 UK / 15:00–15:30 Dubai / 20:00–20:30 KST
- **Room:** `@squid_kor`
- **Format:** text-only; CoinEasy asks in Korean and English, Fig replies in English, the Bot posts the Korean translation
- **Safety:** the feature is off unless `AMA_CAMPAIGN_ENABLED=true`
- **Fig:** already added as a permanent Squid admin. The Bot never promotes, demotes, removes, or restores Fig.
- **Room states:** admin-only during scripted answers → text-only member access for the live-question window → admin-only again → exact original permissions after the AMA

## One-time setup

1. Deploy migration `20260730190000_squid_ama_campaign`.
2. Record Fig’s numeric Telegram ID and confirm the existing permanent admin status.
3. Make Quiz Bot an admin with:
   - Restrict members
   - Add new admins
   - Pin messages
4. Configure the `AMA_*`, `OPENAI_API_KEY`, and `AMA_TRANSLATION_MODEL` values in `.env.example`.
5. Keep `AMA_CAMPAIGN_ENABLED=false` until the migration and environment are ready.
6. Set `AMA_CAMPAIGN_ENABLED=true`, deploy, then run `/ama_preflight`.

Telegram usernames are not accepted for security-sensitive settings. Use numeric chat and user IDs.

## Load the five approved Fig scripts

Do this only in a private DM with Quiz Bot.

1. Send the approved English answer as a normal message.
2. Reply to that message with `/ama_script_set 1`.
3. Repeat for questions 2–5.
4. Run `/ama_script_status`.

The stored questions cover:

1. Product
2. Why `$QUID` exists
3. Staking at a high level
4. What comes next for the product and app
5. Partnerships

The live Bot accepts Fig’s answer only when its wording matches the approved script after whitespace normalization. A changed answer is held and operators are alerted.

## Go-live sequence

| When | Operator action | Expected result |
|---|---|---|
| Before AMA | `/ama_preflight` | Every item is `✅` and the result is `GO` |
| 19:55 KST | `/ama_freeze` | Regular members cannot send; Fig and admins can still post |
| 20:00 KST | `/ama_live` | Intro and live check-in button are posted and pinned |
| During AMA | `/ama_next` | The next approved Korean/English question is posted |
| After each question | Fig replies to that question | Exact English script is accepted and translated to Korean |
| After core Q1–Q5 | `/ama_shortlist` in Bot DM | Shows moderated, non-duplicate community questions |
| 20:14 KST | `/ama_open_floor` | Members can send text questions for three minutes; media and links stay restricted |
| 20:17 KST | `/ama_close_floor` | Member posting is locked again; Fig and admins keep posting |
| Immediately after close | `/ama_question_pack` in Bot DM | Merges duplicates, filters restricted topics, and creates an auditable English Squid review pack |
| Select five | `/ama_lightning_select <question ID>` | Adds the selected bilingual question as Q6–Q10 |
| 20:30 KST | `/ama_restore` | The exact pre-AMA room permissions are restored |
| 20:35 KST | Automatic fallback | A frozen room is restored even if the manual command was missed |

Do not run `/ama_next` again until the previous answer shows its Korean translation. Core answers Q1–Q5 must match the approved scripts. Fig’s Q6–Q10 lightning answers may be free-form because each question is selected by an operator first.

## Participant flow

1. User starts Quiz Bot.
2. User taps **커뮤니티 입장 확인**.
3. Bot verifies membership in `@squid_kor`.
4. User submits up to three questions in Bot DM with `/ama <question>` or during the short live-question window.
5. A valid, non-duplicate question receives `+20 AMA XP`.
6. User taps **친구 초대** and shares a one-tap link. Referral XP and one raffle entry are granted only after the new user starts the Bot and verifies `@squid_kor` membership.
7. During the live window, the user taps **라이브 체크인** for `+15 AMA XP`.
8. `/ama_status` shows verification, questions, qualified referrals, XP, raffle entries, and rank.

Price predictions, guaranteed returns, exchange-listing requests, and financial-advice prompts are filtered.

## Quiz Bot DM distribution

Bulk DM commands work only in a registered operator's private Bot DM and require an explicit `CONFIRM`.

1. Preview: `/ama_dm_preview <stage>`
2. Send: `/ama_dm_send <stage> CONFIRM`
3. Supported stages: `announcement`, `postlaunch`, `day`, `t60`, `recap`

The sender is sequential and rate-limited. A successful recipient is automatically excluded from another send of the same stage. Attempts, successes and non-identifying failure categories are recorded. Operator, Fig and configured test IDs are excluded. Users can tap **AMA DM 알림 중지** or send `/ama_unsubscribe`.

## Preflight rules

`/ama_preflight` stays on `HOLD` unless all are true:

- Fig is already in `@squid_kor` as an admin.
- Quiz Bot has restrict, promote, and pin permissions.
- The room’s current permissions can be read and saved for exact restoration.
- All five approved English scripts are present.
- Translation credentials and model are configured.
- Start and end timestamps are valid.

## Tracked events

| Stage | Events |
|---|---|
| Onboarding | `ama_cta_click`, `ama_room_click`, `tg_join_verified`, `ama_referral_link_created`, `ama_referral_start`, `ama_referral_qualified`, `ama_referral_rejected` |
| Questions | `ama_question_submit`, `ama_question_accepted`, `ama_question_duplicate`, `ama_question_filtered`, `ama_question_pack_generated`, `ama_question_pack_shared` |
| Live | `ama_live_checkin`, `ama_room_frozen`, `ama_speaker_registered`, `ama_question_posted`, `ama_open_floor_started`, `ama_open_floor_question`, `ama_open_floor_ended` |
| Answers | `ama_lightning_question_selected`, `ama_answer_received_en`, `ama_answer_translated_ko`, `ama_translation_failed`, `ama_answer_script_mismatch`, `ama_question_answered_live` |
| Rewards | `ama_xp_awarded` |
| Recovery | `ama_room_restore_triggered`, `ama_room_restored` |

AMA XP uses its own idempotent reward ledger and does not change Orange balances.

## Incident shortcuts

- **Translation failed:** reply to Fig’s stored English answer with `/ama_retranslate`.
- **Live question window still open:** run `/ama_close_floor`; if that fails, use Telegram admin controls to disable member sending and then run `/ama_restore`.
- **Room still frozen:** run `/ama_restore`.
- **Fig answer differs from approval:** ask Fig to reply again with the exact approved script.
- **Preflight cannot read permissions:** do not freeze the room; fix Bot admin rights first.
- **Unexpected behavior:** set `AMA_CAMPAIGN_ENABLED=false` and redeploy. Existing EasyGo Telegram commands remain unchanged when the flag is off.
