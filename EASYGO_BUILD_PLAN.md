# EasyGo Build Plan

> **내부 빌드 플랜 (Internal Build Plan)**
> - 외부 마케팅 자료, 파트너 덱, VC 자료에서는 EasyChain을 풀 앱체인 인프라로 포지셔닝합니다 ("한국 온체인 유저를 위한 앱체인").
> - 이 문서는 **내부 빌드 플랜**입니다. Phase별 정직한 진척 상태와 한계를 기록합니다. 외부 자료와 톤이 다른 것은 의도된 분리입니다.

> **⚠️ Path C decision (2026-04-26)**
> Phase 1 chain target is **Base**, not EasyChain. EasyChain is preserved as a Phase 2 option, gated behind `PHASE.EASYCHAIN_ENABLED` flag.
> Rationale: ship faster, remove Aurora dependency from critical path, validate product–market fit before chain investment. EasyChain brand and infrastructure scaffolding (PR #4) remain intact for Phase 2 activation. See §3.0 below for full rationale.
> External tone (marketing) is unchanged — EasyGo is still positioned around the EasyChain ecosystem narrative for partner / VC conversations.

Status: Draft v2 (Path C)
Owner: @jadenlee7
Target app: coineasy-app (Expo / React Native) → rebrand to **EasyGo** (repo name kept; see PR #4 decision log)
Phase 1 infra: **Base** (L2)
Phase 2 infra (optional): **EasyChain** on Aurora Cloud (EVM virtual chain on NEAR)
Cross-chain layer: **Squid** (Phase 1) + **NEAR Intents** (Phase 2)
Reward unit: **🍊 Orange** (hype-purpose point system, not a token; Phase 1 = backend DB ledger)
Primary user: 한국 온체인 유저 (Korean on-chain users)
Replaces: PR #1 (MIGRATION_PLAN.md, deprecated). PR #2 (RETENTION_PLAN.md) is referenced from §8. Scaffolding: PR #4.

---

## 1. Vision & Target

### 1.1 What we are building

**EasyGo** is a mobile-first crypto app for Korean on-chain users. The product hook is "이지트리 (easy-tree)" — wrap complex on-chain actions (swap, bridge, learn, earn) into a single tap.

**EasyChain** remains the long-term infrastructure narrative — a future EVM virtual chain on Aurora that hosts a Korean on-chain ecosystem. In Phase 1, EasyGo runs on **Base**; EasyChain activation is deferred to Phase 2 contingent on traction.

The user-facing layer is EasyGo. The infrastructure layer (Phase 1) is Base. The reward unit visible everywhere is 🍊 Orange.

### 1.2 Target audience

- **한국 온체인 유저** (Korean crypto-native and crypto-curious users)
- Already hold wallets or are willing to onboard with email/Kakao
- Use Telegram for crypto community participation
- Care about earning, learning, and not paying gas

We deliberately do **not** target Farcaster-native users in Phase 1 — the cultural and language fit is poor for our audience.

### 1.3 Long-term partner principle

> **"우리는 오랫동안 같이 일할 수 있는 툴들이 필요함"**

Orbis is being deprecated by us specifically because the service is shutting down. From this point on, we evaluate every tool by long-term partner stability. The current accepted/rejected list is in §15.

### 1.4 Goals

1. Ship MVP in 4–8 weeks (faster under Path C). Reuse the existing Expo RN UI; replace the backend.
2. Build a "everyone earns" loop: users earn 🍊, brands fund quests, EasyGo takes a margin.
3. Validate product–market fit on Base before committing infra spend on EasyChain.
4. Preserve all major option spaces: EasyChain activation later, tokenization later, cross-chain expansion, NFT market, platform fees.

---

## 2. Brand

| Asset | Value |
|---|---|
| App name | **EasyGo** |
| Chain narrative (long-term) | **EasyChain** |
| Phase 1 actual chain | **Base** (L2) |
| Reward unit | **🍊 Orange** (hype point, not a token in Phase 1) |
| CI mark | "GO EASY" |
| Slogan | "MAKE IT TRUTH" |
| Mascot | Pixel-art avatar set (mushroom-style characters) |
| Accent color | Orange |
| Existing brand assets | Figma EasyChain + Figma EasyGo files |
| Repo name | `coineasy-app` (kept; see PR #4 Option-A decision) |

The "orbis" logo currently present in some marketing assets must be removed during rebrand. It is not a current partner.

---

## 3. Tech Stack

### 3.0 Path C decision (Phase 1 = Base)

**Decision**: Phase 1 ships on **Base** (L2). EasyChain is preserved as a Phase 2 option behind a feature flag.

**Why this matters**

The original plan was to ship Phase 1 directly on EasyChain. On reflection:
1. User-info collection (Telegram ID, Kakao ID, on-chain address) is **not** chain-dependent — Privy + backend DB satisfies this completely on any chain.
2. 🍊 Orange ledger does not require on-chain storage in Phase 1; backend DB is sufficient and simplifies anti-abuse.
3. Aurora response is a critical-path dependency. Path C removes it.
4. EasyChain's strategic value (sequencer revenue, token optionality, brand differentiation) only materializes after traction. Spending on it before traction is risk.
5. Base is mature, has first-class Privy + Squid support, and is well-known to Korean users.

**What we keep from the EasyChain plan**

- The brand (EasyChain) — used externally as the ecosystem narrative.
- The scaffolding code (PR #4: `utils/easychain.js`, hook stubs, `.env.example` Aurora section) — gated by `PHASE.EASYCHAIN_ENABLED = false` until Phase 2.
- The Aurora relationship — paused, not closed. We'll re-engage at Phase 2 entry if traction supports it.
- The Orange tokenization optionality — preserved for Phase 3+, regardless of which chain it lands on.

**What we lose, honestly**

- The "app-chain team" marketing card during Phase 1.
- Sequencer revenue option during Phase 1 (= 0 anyway with no chain liquidity).
- Some momentum with Aurora (mitigated by polite re-engagement message — see §13.1).

### 3.1 Phase 1 stack (committed under Path C)

| Layer | Choice | Rationale |
|---|---|---|
| Client | Expo / React Native (existing repo, rebranded) | Reuse existing UI; ship fast |
| Wallet / Auth | **Privy** (email + Kakao + social login) | Korean-friendly onboarding; long-term stable; collects Telegram/Kakao IDs |
| Chain | **Base** (L2) | Mature, low fee, Privy/Squid first-class support |
| Cross-chain | **Squid** (existing customer relationship) | Mature SDK; mobile + Korean i18n; Telegram channel open |
| Backend | Node.js + Postgres (Supabase) | Open-source, exit-friendly; hosts 🍊 Orange ledger and identity DB |
| 🍊 Orange ledger | **Postgres (idempotent ledger)** | Phase 1 source of truth; no on-chain storage needed |
| On-chain data (read) | Alchemy / Covalent | Read user portfolio from Base/Ethereum/Arbitrum |
| Push (in-app) | Expo Push (existing) | Already integrated |
| Push (Korean retention) | **Telegram Bot** | Highest open rate for Korean crypto users |
| Content CMS | TBD — candidates: Strapi, Notion API, Sanity | Lessons & quest content |

### 3.2 Phase 2 additions (gated behind feature flags)

| Layer | Choice | Activation gate |
|---|---|---|
| **EasyChain (Aurora)** | EVM virtual chain on NEAR | `PHASE.EASYCHAIN_ENABLED = true` after traction milestone (§4.1) |
| Cross-chain v2 | **NEAR Intents** widget | After EasyChain activation + solver coverage |
| NFT market | ERC-721 / 1155 + custom market | After Phase 1 metadata avatars validate demand |
| DEX | Uniswap v2 fork on EasyChain | After EasyChain liquidity bootstrap |
| Solver network | NEAR Intents solvers | Phase 2 mid |

### 3.3 Explicitly rejected for Phase 1

- **EasyChain activation now** — deferred to Phase 2 (traction-gated)
- **Orbis / Ceramic** — service shutdown
- **Farcaster + Frames** — audience mismatch with Korean users
- **EFP / EthID (ENS + EFP + SIWE)** — overkill for Korean general users; reconsider Phase 3+
- **Self-issued token (\$EASY / \$ORANGE)** — regulatory risk; deferred until product-market fit
- **Solana / Sui** — would require throwing away current ethers-based codebase

---

## 4. Phased EasyChain Activation

### 4.1 Activation gate (Phase 1 → Phase 2)

EasyChain activation is **traction-gated**. Activation criteria (any one is sufficient):

- 5,000+ MAU on Base for 2 consecutive months, OR
- $50k+/mo revenue across swap margin + quests + ad reward, OR
- 3+ partner brands committed to deploying on EasyChain (signed LOI), OR
- Strategic event (acquisition offer, KR-regulator-friendly chain mandate, NEAR Intents enterprise opportunity)

If none materialize within 9 months, EasyChain is re-evaluated: continue waiting, or formally shelve and remove the scaffolding.

### 4.2 What changes when EasyChain activates

- `PHASE.EASYCHAIN_ENABLED` flips to `true`
- 🍊 Orange ledger gains an on-chain mirror (Postgres remains source of truth, EasyChain log is auditable shadow)
- Avatar minting moves from metadata-only → on-chain NFT
- New `Profile Registry` contract holds handle + social ID hashes
- Squid / NEAR Intents pipeline extended to settle some receipts on EasyChain
- Sequencer revenue model with Aurora becomes live (per §4.4)

### 4.3 What does NOT depend on EasyChain (Phase 1 scope)

- All user-info collection (Telegram ID, Kakao ID, wallet address) → Privy + Postgres
- All financial actions (swap, send, bridge) → Squid on Base
- 🍊 Orange earn / spend → Postgres
- Notifications, learning content, quests, referral → backend + Telegram Bot
- Avatar selection (Phase 1 = metadata only)
- Korean retention loop

### 4.4 Sequencer revenue model — to be negotiated with Aurora (Phase 2 only)

Open items, deferred to Phase 2 entry meeting:

- Revenue split when gas is non-zero (Aurora % vs coineasy %)
- "Free Gas for users" mode: who absorbs sequencer cost
- MEV handling policy (suppress, share, capture-by-coineasy)
- Chain owner governance scope (upgrade rights, parameter changes)

### 4.5 Liquidity bootstrap strategy (Phase 2 onward)

EasyChain has no native liquidity at activation. Mitigation:

1. **Activation moment — Lazy Liquidity via Squid**
   - User-facing send/swap remains a single flow in EasyGo, but settlement happens on Base / Ethereum / Solana via Squid Composable Calls.
   - EasyChain holds receipts, not assets.
   - Capital lock-up: near zero.
2. **Mid-Phase 2 — Seed liquidity + canonical bridge**
   - coineasy seeds ~\$50–100k of USDC + ETH into EasyChain canonical bridge.
   - First DEX pair launches.
   - Squid registers EasyChain as a formal route (not lazy).
3. **Phase 3 — DEX + solver network**
   - Native DEX with 🍊 Orange-incentivized LP.
   - NEAR Intents solvers recruited via Aurora.
   - Partner projects deploy tokens with paired liquidity.

### 4.6 Pros / cons of owning a chain (still valid; just deferred)

**Pros (preserved as Phase 2 optionality)**

- Data sovereignty (Korean user data not held by third-party protocol)
- Full technical control (gas model, opcodes, custom features)
- Token issuance optionality
- Stronger BD pitch
- Higher exit / acquisition value
- Brand IP differentiation in Korean market

**Cons / risks (why we deferred)**

- Cold-start liquidity problem
- Aurora dependency on critical path
- Operational complexity (audit, monitoring, RPC, indexer, explorer)
- Risk of being a "ghost chain" if Phase 2 doesn't materialize

Path C addresses these by validating the user-side product first.

---

## 5. EasyGo App Structure (per Figma)

### 5.1 Bottom tab navigation (5 tabs)

1. **Home** — feed, daily check-in, recommended quests
2. **Earn** (highlighted center tab, orange box icon) — quests, ad reward, learning
3. **Stats** — user portfolio, on-chain activity summary
4. **Trade** — Send / Swap (this is where Squid is embedded)
5. **Profile** — avatar, social connections, 🍊 balance, settings

### 5.2 Core flows (from Figma)

- **Login**: Privy email / Kakao social → wallet auto-created on Base
- **Profile Avatar**: select pixel avatar + background (Phase 1: free choice from default set; Phase 2: NFT marketplace)
- **Send (Step 1 → 2 → 3)**: Token select → destination chain select → amount/info → confirm. Backed by Squid in Phase 1.
- **Notification inbox**: filters All / Replies / Activity / Rewards / Notices (per Figma)
- **Daily check-in**: claim 🍊 Orange daily, streak counter

### 5.3 Visual language

- Orange accent on white background
- Rounded corners, friendly tone (not "wallet app cold")
- Pixel-art mushroom avatars
- Header always shows 🍊 balance prominently

---

## 6. 🍊 Orange Point System

### 6.1 Nature

🍊 Orange is a **hype-purpose point system**. Not a token in Phase 1.

- **Phase 1 storage**: Postgres only (idempotent ledger). No on-chain storage.
- **Phase 2 storage** (after EasyChain activation): Postgres remains source of truth; EasyChain hosts an auditable shadow log.
- Cannot be withdrawn, traded, or transferred outside the app.
- No fiat / crypto conversion guarantee.
- Design preserves option to tokenize in Phase 3+ if regulation and product fit allow.

### 6.2 Earn paths (per Figma notification spec)

- Daily check-in (3–9 AM KST window)
- Lesson completion ("Crypto Wallets 101" etc.)
- Quest completion (brand-funded)
- Ad reward ("Watch & Earn")
- Referral Step 1 (friend signs up)
- Referral Step 2 (friend completes activity)
- Social engagement bonuses (capped to prevent farming)

### 6.3 Spend paths

- Phase 1: status / streak / leaderboard visibility only
- Phase 2: avatar marketplace (cosmetic NFT purchases) — requires EasyChain activation
- Phase 2+: priority quest access, early alpha drops, premium features

### 6.4 Accounting

- **Phase 1 source of truth**: Postgres (idempotent ledger)
- **Phase 2 mirror**: EasyChain event log (transparency + future tokenization migration path)
- Anti-abuse: rate limits per action, device fingerprinting; on-chain proof for high-value events comes in Phase 2

---

## 7. Avatar System

### 7.1 Phase 1 — metadata only

- Default avatar set (7 pixel-art designs from Figma) + 7 background colors
- User selection stored in Postgres user profile
- No NFT minting yet (Base or otherwise)

### 7.2 Phase 2 — NFT marketplace (gated by EasyChain activation)

- Avatars become ERC-721 / 1155 NFTs on EasyChain (or Base if EasyChain stays deferred)
- Custom avatars with rarity tiers
- Trade between users with marketplace fee (5–10%)
- 🍊 Orange usable as partial payment

---

## 8. Notifications

Full categorical spec is documented in the Figma EasyGo file (Frame 2147257279) and previously expanded in [RETENTION_PLAN.md](./RETENTION_PLAN.md).

### 8.1 Categories (Figma + Retention Plan aligned)

1. **Replies** — likes, comments, replies, new followers
2. **Activity** — daily reminder, lesson recommendations, new content drops
3. **Reward** — daily check-in, ad reward, inactive-recovery, friend joined, referral
4. **Notices (System)** — app update, maintenance (KST scheduled), policy changes

### 8.2 Infrastructure

- **In-app push**: Expo Notifications + FCM (already integrated in repo)
- **Korean retention channel**: **Telegram Bot** for high-importance events (claim ready, reward unlocked, friend joined)
- **Rate limiting**: per-category daily caps (Replies digest after 100 likes, etc.)
- **Time zone**: all schedules in **KST** (Maintenance 2–4 AM KST, login reward window 3–9 AM KST)

### 8.3 Telegram Bot scope

- One-way notifications only in Phase 1 (no two-way commands beyond /start, /link, /unlink)
- Opt-in required during onboarding
- Privacy: notification content references EasyGo identifiers only, never wallet addresses or amounts in plain text without user consent

---

## 9. Identity & Social Connections

### 9.1 EasyGo profile composition

| Field | Source | Required? |
|---|---|---|
| Wallet address | Privy auto-generated (Base) or imported | Yes |
| Email | Privy login | Yes (one of: email/Kakao/Google) |
| Display name | User input or auto-suggested | Yes |
| Avatar | Selected from set (Phase 1) | Yes |
| Telegram handle | OAuth via Telegram Login Widget | Optional (strongly encouraged) |
| X (Twitter) | OAuth | Optional |
| Kakao | OAuth | Optional, Korean-priority |
| ENS name | Read-only display from mainnet | Optional |

All identity fields stored in Postgres in Phase 1. Privy handles the OAuth flow and surfaces verified IDs to backend.

### 9.2 Why Telegram is critical

- Korean crypto community lives on Telegram
- Reach for retention notifications is far higher than push
- Brands willing to pay for opt-in targeted reach (Phase 2 revenue path)
- Free infrastructure (Telegram Bot API)

### 9.3 Privacy & consent

- Each social connection requires explicit user opt-in
- 개인정보처리방침 (privacy policy) must list all collected fields with purpose
- Korean PIPA (개인정보보호법) compliance required before launch
- Targeted messaging to brands is permitted only with explicit opt-in scope per category

---

## 10. Learning Content Engine

### 10.1 Content tracks (from Figma — examples cited)

- "Crypto Wallets 101"
- "Train Your Brain" (daily learning streak)
- "Push Topic Alert" (new topic drops)
- Continue Learning / Lesson Recommendation

### 10.2 Implementation

- CMS choice: TBD (Strapi self-hosted vs Notion API vs Sanity)
- Lesson completion proof: Postgres event in Phase 1 (no on-chain anchor needed); EasyChain event log added in Phase 2
- Reward issuance: 🍊 Orange via backend Postgres ledger
- Streak tracking: Postgres + push notification triggers

---

## 11. Revenue Model

### 11.1 EasyGo app revenue (Phase 1, immediate)

| Source | Mechanism | Estimate at MAU 10k |
|---|---|---|
| Swap margin (via Squid on Base) | 0.1–0.3% partner fee on cross-chain swaps | ~\$1.5–4.5k / mo |
| Ad reward | "Watch & Earn" — AdMob-style network share, coineasy ~30% | ~\$0.5–2k / mo |
| Quest brokerage (early) | Brands fund 🍊 quests, coineasy keeps 30–50% margin | ~\$5–20k / mo with 1–3 partners |

### 11.2 EasyChain infrastructure revenue (Phase 2+, gated)

Not realized in Phase 1. Becomes possible only after EasyChain activation per §4.1.

| Source | Mechanism |
|---|---|
| Sequencer share | Negotiated split with Aurora |
| DEX trading fee | 0.3% per swap on native DEX |
| MEV (optional) | Sequencer ordering, captured or shared |

### 11.3 Korean-specific revenue (Phase 2+)

| Source | Mechanism |
|---|---|
| Telegram targeted messaging | Opt-in based brand campaigns |
| Anonymized data insights | Korean on-chain user behavior reports for projects entering KR |

### 11.4 Platform revenue (Phase 3+)

| Source | Mechanism |
|---|---|
| Project deployment fee | Onboarding package for partner projects launching on EasyChain |
| Token launch services | Fair launch tooling, audit packaging |
| Marketplace fees | NFT avatars, partner asset trading |

### 11.5 Phase revenue ranges (rough, internal)

| Phase | Window | Monthly revenue range |
|---|---|---|
| Phase 1 (MVP on Base) | 0–3 mo | ~\$5–15k |
| Phase 2 (growth; EasyChain activation candidate) | 3–9 mo | ~\$50–200k |
| Phase 3 (ecosystem, EasyChain live) | 9–18 mo | ~\$200k–1M |
| Phase 4 (platform) | 18+ mo | \$1M+ |

These are working assumptions for sequencing decisions, not forecasts.

---

## 12. Orbis → EasyGo Backend Migration (file-level)

Based on inspection of jadenlee7/coineasy-app current master:

### 12.1 Files to remove / replace

- `package.json` line 19: `@orbisclub/orbis-sdk` (forked) — **remove**
- `App.js` lines 65–66 import + lines 74–82 `new Orbis({...})` — **remove and replace** with EasyGo backend client
- `utils/index.js` lines 37, 129–132, 220: calls to `api.orbis.club/get-nfts`, `/get-balance`, `/get-poap-ownership` — **replace** with `api.easygo.app/*` endpoints (or chosen domain)
- `utils/config.js`: 3 Ceramic stream context IDs — **replace** with EasyGo feed/channel UUIDs
- `hooks/useDidToAddress`, `useGetUsername`, `useGetMentionedDid` — **replace** with wallet-address-based equivalents
- `contexts/GlobalContext.js` field `orbis: null` — **remove**

### 12.2 Files to keep

- All UI components and screens
- Expo / RN project setup
- Privy integration (extend, do not replace)
- `utils/push.js` (expo-notifications + expo-device + expo-constants)
- `app.json` FCM config and EAS Update channel
- Navigation and state management

### 12.3 New files (already added in PR #4)

- `utils/easygo.js` — branding + phase flags + feature flags
- `utils/easychain.js` — Phase 2-gated network config + provider stub
- `utils/squid.js` — Squid SDK wrapper for Send / Swap flows on Base
- `utils/telegram.js` — Telegram Login Widget integration
- `hooks/useOrange.js` — 🍊 balance and earning hook (Postgres-backed in Phase 1)
- `hooks/useEasyChainProfile.js` — Phase 2 profile hook (no-op when EasyChain disabled)
- `.env.example` — Aurora / Squid / Privy / Telegram placeholders

### 12.4 Strategy

- **Clean cutover** for legacy Orbis data — no migration of historical posts. Communicate to existing users with a launch announcement.
- **One PR per major file group** to keep review tractable.

---

## 13. Partnership Open Items

### 13.1 Aurora (EasyChain — Phase 2, not now)

**Path C status: relationship paused, not closed.** Re-engage at Phase 2 entry meeting.

Polite holding message to send (draft in §13.4):

- Phase 1 will ship on Base to compress timeline and validate PMF.
- EasyChain remains in our long-term plan; activation criteria are documented internally.
- Keep the door open for Q3/Q4 conversation when traction is clearer.

When we re-engage, agenda is unchanged from prior version:

1. EasyChain monthly fixed cost / sequencer operation model
2. Revenue split for sequencer / "Free Gas" subsidy model
3. NEAR Intents widget availability for embedding in EasyGo
4. Solver network introduction
5. Aurora marketing / BD support for ecosystem partner recruitment
6. Chain owner governance scope and upgrade process
7. SLA, uptime guarantees, escape hatch / data export rights
8. Korean-language documentation and support

### 13.2 Squid (cross-chain layer on Base — Phase 1)

Existing Telegram group chat with Squid team. Lead: **TBD** (assign in next standup). Path C agenda (EasyChain route items removed; Base-focused):

1. Squid widget embed in EasyGo on **Base** — iframe / SDK, Korean language, mobile (Expo RN) compatibility
2. Fee model — partner fee share / volume rebate, given coineasy is an existing customer
3. Joint launch case study / co-marketing opportunity (Korean retail focus)
4. Failover / fallback if a route is unavailable mid-transaction
5. (Phase 2, deferred) EasyChain route addition when activation criteria are met
6. (Phase 2, deferred) Lazy Liquidity pattern on EasyChain
7. (Phase 2, deferred) Formal route registration timeline for EasyChain

### 13.3 Privy

- Confirm Korean / Kakao social login support and pricing tier
- Confirm React Native Expo SDK feature parity
- Confirm long-term roadmap stability
- Confirm Telegram social login integration and the user data fields exposed to backend

### 13.4 External message drafts (for owner to send)

**To Aurora (timing adjustment):**

> Hey [Aurora contact] 👋 — quick update on EasyGo. We've decided to ship Phase 1 on Base to compress our timeline and validate product–market fit with Korean users first. EasyChain is very much still in our long-term plan; we'd like to keep the conversation open and re-engage at Phase 2 entry, likely Q3/Q4 once traction is clearer. Apologies for the timing shift — happy to share what we learn from the Base launch as we go.

**To Squid (Phase 1 on Base):**

> Hey team 👋 quick update from coineasy / EasyGo side — we're shipping our Phase 1 on **Base**, and Squid is our primary cross-chain rail. A few things I'd love to align on before we lock in the integration timeline:
>
> 1. Widget embed inside EasyGo (Expo RN): iframe + SDK options. Two must-haves: Korean language + mobile (React Native / Expo) compatibility. What's the current SDK story for RN, and is i18n already in place?
> 2. Fee model: given coineasy is already a customer, can we discuss partner fee share / volume rebate for the EasyGo integration?
> 3. Joint launch / co-marketing: open to a launch case study or joint announcement when EasyGo ships? Korean retail is the primary target audience.
> 4. Failover behavior: if a route becomes unavailable mid-transaction, what's the fallback path users see — refund, alternate route auto-selection, or manual retry?
>
> (Aside) We have an own-chain (EasyChain on Aurora) on the longer-term roadmap. We'll loop you in when that's closer to activation.
>
> Happy to schedule a 30-min call if that's faster. Otherwise async here works too.

---

## 14. Roadmap

### Phase 0 — Setup (0–2 weeks, faster under Path C)

- [ ] Send Aurora "timing adjustment" message (per §13.4)
- [ ] Squid kickoff in existing Telegram group (Base-focused agenda per §13.2)
- [ ] Privy plan confirmation + Telegram OAuth setup
- [ ] Decide Korean entity / privacy policy posture
- [ ] Repo decision: keep `coineasy-app` (Option A, confirmed in PR #4 comment)

### Phase 1 — MVP on Base (2–8 weeks)

- [ ] Internal rebrand: assets, package name, app config (repo name unchanged)
- [ ] Remove Orbis (per §12)
- [ ] Stand up EasyGo backend (Node + Postgres) — identity DB + 🍊 Orange ledger
- [ ] Privy login + Telegram OAuth + Kakao OAuth
- [ ] Squid Send / Swap flow live on Base
- [ ] 🍊 Orange ledger + daily check-in (Postgres)
- [ ] Notification system per §8 (Expo + Telegram Bot)
- [ ] Pixel avatar selection (metadata only)
- [ ] Closed beta (100–500 Korean users)

### Phase 2 — Growth + EasyChain activation candidate (3–9 months)

- [ ] Public launch on Base
- [ ] First 1–3 brand quest partners
- [ ] Evaluate EasyChain activation gate (§4.1) monthly
- [ ] If gate met: re-engage Aurora, deploy EasyChain, flip `PHASE.EASYCHAIN_ENABLED`, mirror 🍊 ledger on-chain
- [ ] Avatar NFT market (mint + trade) — destination chain decided at activation time
- [ ] Squid formal route registration on EasyChain (only if activated)
- [ ] NEAR Intents widget integration evaluation (only if EasyChain active)
- [ ] Telegram targeted messaging product (opt-in only)
- [ ] On-chain insight reports (anonymized)

### Phase 3 — Ecosystem (9–18 months, EasyChain-dependent)

- [ ] Native DEX with 🍊 LP incentives (requires EasyChain)
- [ ] First external project deploys on EasyChain
- [ ] Token launch tooling
- [ ] NEAR Intents solver coverage live
- [ ] Anonymized data products productized
- [ ] Expansion: SE Asia or other regional markets

### Phase 4 — Platform (18+ months)

- [ ] Self-serve project deployment portal
- [ ] Tokenization of 🍊 Orange (only if regulation and PMF align)
- [ ] Sequencer revenue at meaningful scale

---

## 15. Appendix — Long-term Partner Tool Checklist

| Tool | Decision | Rationale |
|---|---|---|
| Privy | ✅ Adopt (Phase 1) | $40M+ funded, wallet infra standard, Korean-friendly, user identity surface |
| Base | ✅ Adopt (Phase 1 chain) | Mature L2, low fee, Privy/Squid first-class support |
| Squid | ✅ Adopt (Phase 1 main) | Existing customer; Axelar-backed; mature on Base |
| Expo / EAS | ✅ Keep | Industry-standard RN tooling |
| Telegram Bot API | ✅ Adopt | Free, permanent, fits Korean user behavior |
| Alchemy / Covalent | ✅ Adopt | Multi-year stable on-chain data infra |
| Supabase / Postgres | ✅ Adopt | Open-source backed, self-host exit possible |
| FCM / Expo Push | ✅ Keep | Already integrated |
| Aurora Cloud (EasyChain) | ⏸ Phase 2 (deferred) | Re-engage when traction gate (§4.1) met |
| NEAR Intents | ⏸ Phase 2 (deferred) | Activates after EasyChain |
| Orbis | ❌ Remove | Service shutting down |
| Farcaster Hubs / Frames | ❌ Skip | Audience mismatch with Korean users |
| EFP / EthID | ❌ Skip Phase 1 | Overkill; reconsider Phase 3+ |
| Lens Protocol | ❌ Skip | Ecosystem mismatch |
| Solana / Sui | ❌ Skip | Codebase rewrite cost; identity stack reset |
| Self-issued token (Phase 1) | ❌ Skip | Regulatory risk; defer to Phase 3+ |

---

## Document changelog

- **v2 (Path C)**: Phase 1 chain switched from EasyChain to Base. EasyChain preserved as Phase 2 option behind activation gate. 🍊 Orange ledger on Postgres in Phase 1. Aurora relationship paused (not closed). Squid agenda pruned to Base-only items. External marketing tone unchanged. Triggered by realization that Privy already satisfies user-info collection requirements regardless of chain choice.
- v1 (initial draft): consolidates decisions from chat sessions on Orbis migration, EthID/Easychain rearchitecture, retention plan, chain selection, social graph evaluation, Korean user targeting, Squid vs NEAR Intents, liquidity bootstrap, sequencer revenue, internal/external tone separation. Supersedes MIGRATION_PLAN.md (PR #1).
