# Retention Plan: Reward Visibility + Notification Strategy

Status: Draft
Owner: @jadenlee7
Target app: coineasy-app (Expo / React Native)

Current push infra (confirmed in repo):

- `expo-notifications` + `expo-device` + `expo-constants` in `utils/push.js`
- Android FCM via `google-services.json` declared in `app.json`
- EAS Update channel: `u.expo.dev/92489131-f028-4eb8-96ef-453311e899ec`
- No category/channel segmentation today; all pushes share one handler with `shouldShowAlert / shouldPlaySound / shouldSetBadge = true`

Thesis: for an earn app, "how much did I make" must be felt in under one second of opening the app. If that breaks, retention breaks. Everything below serves that one metric.

---

## 1. Reward visibility — 4 layers

### Layer 1 — Permanent counter (home header)

- Always-on lifetime earnings display at the top of `screens/Home`.
- Two values: lifetime earned (big) + withdrawable now (small, tappable → withdraw flow).
- Read path: Easychain `Reward` contract aggregate via content API; cached locally so the number is visible instantly on cold start (optimistic render, reconcile on fetch).
- Acceptance: value is visible within 300ms of cold start; never shows blank / spinner as the first frame.

### Layer 2 — Micro-feedback on earn event

- When a reward lands: count-up animation on the header counter (300ms, easing out), haptic pulse (`expo-haptics` `notificationAsync('success')`), particle / confetti burst anchored to the counter (reuse existing `react-native-confetti-cannon`).
- Foreground trigger: websocket / polling from content API pushes a `RewardAccrued` event.
- Background trigger: push notification arrives with `data.kind = "reward"` → on app open, replay the animation once.
- Acceptance: the full effect runs under 400ms and never blocks user input.

### Layer 3 — Streak + milestone

- Daily streak counter ("N days") visible on home.
- Progress bar to next milestone reward (e.g. "$12.40 / $15 to next payout bonus").
- Streak rules: one qualifying action per UTC day extends the streak; "freeze" token once per week to forgive a missed day (prevents rage-quit on a single missed day, Duolingo pattern).
- Milestones stored on Easychain `Reward` contract; progress bar reads from contract + indexer.
- Acceptance: streak never resets silently; if about to break, user gets a dedicated push at T-2h in their local evening.

### Layer 4 — Weekly recap share card

- Every Monday 09:00 local, generate a 1080x1350 image card: "This week on Coineasy — $47.12 earned, 5-day streak, #123 on leaderboard".
- One-tap share to X (Twitter), Telegram, Instagram stories via `expo-sharing` + `react-native-view-shot`.
- Card rendered client-side from a template (no server-rendered image for v1).
- Referral footer on every card: short link `coineasy.xyz/r/<ensName>`.
- Acceptance: from recap screen to posted tweet in ≤ 3 taps.

---

## 2. Notification strategy — 4 buckets, different cadences

Principle: spam → mute → dead app. Bucket separation + user-visible on/off switches from day one.

| Bucket | Trigger | Cadence | Default | Android Channel | iOS category |
| --- | --- | --- | --- | --- | --- |
| Transactional | Reward accrued, withdrawal ready, withdrawal confirmed | Immediate, every time | ON | `transactional` (IMPORTANCE_HIGH, sound on) | `TXN` |
| Social | New follower, comment, mention, repost | Digested, 1–2 per day | ON | `social` (IMPORTANCE_DEFAULT, sound off) | `SOCIAL` |
| Quests | New campaign / daily quest | 1 per day, 09:00 local | ON | `quests` (IMPORTANCE_DEFAULT) | `QUESTS` |
| Alpha | Market moves, smart-money signals | Importance-filtered, max 2 / day | OFF by default (opt-in) | `alpha` (IMPORTANCE_LOW) | `ALPHA` |

Expo implementation sketch:

- Create four Android notification channels on first launch via `Notifications.setNotificationChannelAsync('transactional', {...})` etc. iOS uses `categoryIdentifier` on the payload.
- Server attaches `channelId` + `categoryIdentifier` + `data.bucket` to every push.
- `utils/push.js` routes on `data.bucket` to pick UI (badge, sound, in-app toast vs. full banner).
- User preferences stored in AsyncStorage mirrored to backend so preferences survive reinstall.
- Settings screen: four toggles + per-bucket quiet hours.

Digest logic (Social bucket):

- Backend buffers social events per user; at 12:00 and 19:00 local, emits one summary push: "3 new followers, 2 comments on your post".
- Tap → deep link to aggregated inbox.

Quiet hours:

- Global quiet hours user-configurable (default 22:00–08:00 local).
- Transactional bucket bypasses quiet hours only if amount ≥ threshold (default $1).

---

## 3. Dopamine design — avoid the slot-machine trap

Do:

- Make the real money flow the reward. Number goes up, haptic, confetti.
- Show determinism: "post today → earn between $0.10–$0.30" ranges, not hidden odds.
- Lean on progress feelings (Strava): streaks, milestones, leaderboards, public badges.

Don't:

- Variable random-box rewards ("open for $0.01 or $10"). Short-term DAU lift, long-term churn + "scammy" brand tag + regulatory exposure in multiple jurisdictions.
- Hidden multipliers or surprise nerfs. Every earning rule must be visible in the app.
- Dark patterns on withdrawal (min thresholds that creep up, delays).

Framing: the app already delivers a stronger hit than a slot machine — real money leaving the app into the user's wallet. Our job is to surface that feeling, not to invent synthetic gambles on top.

---

## 4. Week 1 — the three things that matter

Ship these three, in order. Nothing else in week 1.

### W1-1. Home header permanent earn counter

- New component `components/EarnHeader.tsx`.
- Data: `useLifetimeEarned(address)` hook reading from content API, hydrated from AsyncStorage for instant first paint.
- Placement: top of `screens/Home` above existing feed.
- Telemetry: log `home_header_viewed` with value to confirm users see a non-zero number.

### W1-2. Transactional push on reward accrual

- Backend emits push on every `RewardAccrued` event from Easychain indexer.
- Expo push payload fields: `to` (expo token), `title` ("+$0.24 earned"), `body` ("Lifetime: $47.12"), `data` (`bucket=transactional`, `kind=reward`, `amount`, `lifetime`, `txHash`), `channelId=transactional`, `categoryIdentifier=TXN`, `sound=default`, `priority=high`.
- Client: on receive, update cached lifetime, schedule count-up animation for next foreground.
- Acceptance: p95 event → device ≤ 10s.

### W1-3. Weekly recap share card

- New screen `screens/WeeklyRecap.tsx` with view-shot template.
- Trigger: Monday 09:00 local push ("Your week: $47.12 earned") → deep link opens recap.
- Actions: Share to X / Telegram / IG stories / Copy image.
- Referral short link auto-appended.

Explicitly deferred to post-10k-users:

- Streak freeze economy.
- Alpha bucket (requires signal pipeline).
- Public leaderboards beyond top-100.
- Social digest tuning (ship naive digest first, tune later).

---

## 5. Backend surface this adds

- `POST /push/register` — store Expo token, platform, locale, timezone.
- `POST /push/preferences` — per-bucket on/off + quiet hours.
- Worker `rewards-fanout` — subscribes to Easychain indexer, fans out Transactional pushes.
- Worker `social-digest` — runs at 12:00 and 19:00 per user timezone, emits Social digest.
- Worker `quests-daily` — runs at 09:00 per user timezone, emits Quests push.
- Cron `weekly-recap` — Monday 09:00 per user timezone, emits recap deep link.
- All workers go through Expo Push API (batched, respects rate limits).

Why keep Expo Push (not switch to OneSignal) now:

- Already wired and free at our scale.
- Switching adds SDK surface, auth, and a vendor dependency without solving any current bottleneck.
- Revisit when we need rich-media pushes, cross Expo Push batch limits consistently, or need per-user A/B on push copy at scale.

---

## 6. Metrics to watch

- D1 / D7 / D30 retention overall and split by push permission granted vs. not.
- Open rate per bucket. Target: Transactional > 40%, Social > 15%, Quests > 20%, Alpha > 10%.
- Unsubscribe rate per bucket. Target: < 5% in first 30 days per bucket.
- Share card: recap-screen → external-share conversion. Target: > 25%.
- Lifetime earn counter: % of sessions where counter increased since last open. Target: > 60% at week 4.

---

## 7. Implementation order (once Easychain endpoints land)

1. `components/EarnHeader.tsx` + `hooks/useLifetimeEarned.ts` (mock data first, API wiring second).
2. Four Android notification channels + iOS categories in `utils/push.js`.
3. `screens/Settings/Notifications.tsx` with four bucket toggles + quiet hours.
4. Backend: `POST /push/register`, `POST /push/preferences`, `rewards-fanout` worker.
5. Haptics + count-up animation on counter.
6. `screens/WeeklyRecap.tsx` + share flow.
7. Streak + milestone UI.
8. Social digest + Quests daily workers.

---

## 8. Open questions

- Do we already have a backend service we can host workers on, or do we stand one up as part of this (suggest: Cloudflare Workers + Durable Objects, or a small Node service next to the Easychain indexer)?
- Which currency do we display? USD (converted from base token) or base token itself? Suggest USD primary, base token secondary for earn-app framing.
- Withdrawal UX: withdraw-to-wallet-only, or offer fiat off-ramp via Aurora Cloud Onramp partner?
- Do we want the share card referral link to credit a referral bonus on both sides? If yes, specify the economic split before shipping W1-3.
