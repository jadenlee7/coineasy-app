# EasyGo Build Plan

> **내부 빌드 플랜 (Internal Build Plan)**
> - 외부 마케팅 자료, 파트너 덱, VC 자료에서는 EasyChain을 풀 앱체인 인프라로 포지셔닝합니다 ("한국 온체인 유저를 위한 앱체인").
> - 이 문서는 **내부 빌드 플랜**입니다. Phase별 정직한 진척 상태와 한계를 기록합니다. 외부 자료와 톤이 다른 것은 의도된 분리입니다.

Status: Draft v1
Owner: @jadenlee7
Target app: coineasy-app (Expo / React Native) → rebrand to **EasyGo**
Target infra: **EasyChain** on Aurora Cloud (EVM virtual chain on NEAR)
Cross-chain layer: **Squid** (Phase 1) + **NEAR Intents** (Phase 2)
Reward unit: **🍊 Orange** (hype-purpose point system, not a token)
Primary user: 한국 온체인 유저 (Korean on-chain users)
Replaces: PR #1 (MIGRATION_PLAN.md, deprecated). PR #2 (RETENTION_PLAN.md) is referenced from §8.

---

## 1. Vision & Target

### 1.1 What we are building

**EasyGo** is a mobile-first crypto app for Korean on-chain users. The product hook is "이지트리 (easy-tree)" — wrap complex on-chain actions (swap, bridge, learn, earn) into a single tap. **EasyChain** is our own EVM virtual chain on Aurora that powers the app and, over time, hosts a Korean on-chain ecosystem.

The user-facing layer is EasyGo. The infrastructure layer is EasyChain. The reward unit visible everywhere is 🍊 Orange.

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

1. Ship MVP in 4–10 weeks. Reuse the existing Expo RN UI; replace the backend.
2. Build a "everyone earns" loop: users earn 🍊, brands fund quests, EasyGo takes a margin, EasyChain captures sequencer/data value.
3. Bootstrap an ecosystem (Phase 2+) where partner projects deploy on EasyChain.
4. Preserve all major option spaces: tokenization later, cross-chain expansion, NFT market, platform fees.

---

## 2. Brand

| Asset | Value |
|---|---|
| App name | **EasyGo** |
| Chain name | **EasyChain** |
| Reward unit | **🍊 Orange** (hype point, not a token in Phase 1) |
| CI mark | "GO EASY" |
| Slogan | "MAKE IT TRUTH" |
| Mascot | Pixel-art avatar set (mushroom-style characters) |
| Accent color | Orange |
| Existing brand assets | Figma EasyChain + Figma EasyGo files |

The "orbis" logo currently present in some marketing assets must be removed during rebrand. It is not a current partner.

---

## 3. Tech Stack

### 3.1 Phase 1 stack (committed)

| Layer | Choice | Rationale |
|---|---|---|
| Client | Expo / React Native (existing repo, rebranded) | Reuse existing UI; ship fast |
| Wallet / Auth | **Privy** (email + Kakao + social login) | Korean-friendly onboarding; long-term stable |
| Chain | **EasyChain** on Aurora Cloud | Brand asset; Aurora support; future ecosystem host |
| Cross-chain | **Squid** (existing customer relationship) | Mature SDK; Lazy Liquidity pattern; Telegram channel open |
| Backend | Node.js + Postgres (Supabase) | Open-source, exit-friendly |
| Indexer | Self-hosted listener on EasyChain RPC + Postgres | Avoid third-party indexer dependency in Phase 1 |
| On-chain data (external chains) | Alchemy / Covalent | Read user portfolio from Base/Ethereum/Arbitrum |
| Push (in-app) | Expo Push (existing) | Already integrated |
| Push (Korean retention) | **Telegram Bot** | Highest open rate for Korean crypto users |
| Content CMS | TBD — candidates: Strapi, Notion API, Sanity | Lessons & quest content |

### 3.2 Phase 2 additions (planned)

| Layer | Choice | When |
|---|---|---|
| Cross-chain v2 | **NEAR Intents** widget | After Aurora confirms widget availability and EasyChain has enough liquidity for solver coverage |
| NFT market | EasyChain ERC-721 / 1155 + custom market | After Phase 1 metadata avatars validate demand |
| DEX | Uniswap v2 fork on EasyChain | After liquidity bootstrap |
| Solver network | NEAR Intents solvers (recruited via Aurora) | Phase 2 mid |

### 3.3 Explicitly rejected for Phase 1

- **Orbis / Ceramic** — service shutdown
- **Farcaster + Frames** — audience mismatch with Korean users
- **EFP / EthID (ENS + EFP + SIWE)** — overkill for Korean general users; reconsider Phase 3+
- **Self-issued token ($EASY / $ORANGE)** — regulatory risk; deferred until product-market fit
- **Solana / Sui** — would require throwing away current ethers-based codebase

---

## 4. EasyChain Architecture

### 4.1 Phased justification (internal honesty)

**Phase 1 reality**: EasyChain functions primarily as a *data and accounting layer*. All EasyGo actions (posts, follows, learning completion, 🍊 ledger, avatar metadata, referral records) are written here. Financial actions (swaps, sends) are settled on external chains via Squid Lazy Liquidity. EasyChain is not yet a "fully alive" chain in the liquidity sense.

**Phase 2 transition**: Bring external value into EasyChain — first DEX pair, first partner project deployment, NEAR Intents solver coverage. Sequencer revenue starts to matter.

**Phase 3 ecosystem**: EasyChain becomes the default deployment target for Korean projects targeting Korean users. Sequencer + DEX fees + deployment fees become primary revenue.

This phased view is internal. Externally we present EasyChain as the chain it will become.

### 4.2 Sequencer revenue model — to be negotiated with Aurora

Open items for Aurora meeting:
- Revenue split when gas is non-zero (Aurora % vs coineasy %)
- "Free Gas for users" mode: who absorbs sequencer cost (Aurora subsidy vs coineasy monthly fee vs hybrid)
- MEV handling policy (suppress, share, capture-by-coineasy)
- Chain owner governance scope (upgrade rights, parameter changes, validator set if any)

### 4.3 Liquidity bootstrap strategy

EasyChain has no native liquidity at launch. This is the standard cold-start problem for any new app-chain. Plan:

1. **Phase 1 — Lazy Liquidity via Squid**
   - User-facing send/swap is one flow in EasyGo, but actual settlement happens on Base / Ethereum / Solana via Squid Composable Calls.
   - EasyChain holds receipts, not assets.
   - Capital lock-up: near zero.

2. **Phase 2 — Seed liquidity + canonical bridge**
   - coineasy seeds ~$50–100k of USDC + ETH into EasyChain canonical bridge.
   - First DEX pair launches.
   - Squid registers EasyChain as a formal route (not lazy).

3. **Phase 3 — DEX + solver network**
   - Native DEX with 🍊 Orange-incentivized LP.
   - NEAR Intents solvers recruited via Aurora.
   - Partner projects deploy tokens with paired liquidity.

### 4.4 Pros / cons of owning the chain (honest)

**Pros**
- Data sovereignty (Korean user data not held by third-party protocol)
- Full technical control (gas model, opcodes, custom features)
- Token issuance optionality preserved
- Stronger BD pitch (two-tier: "use EasyGo" + "deploy on EasyChain")
- Higher exit / acquisition value
- Brand IP differentiation in Korean market
- Compliance flexibility for Korean regulation

**Cons / risks**
- Cold-start liquidity problem (mitigated by §4.3)
- Aurora dependency (mitigated by EVM-compat → portable; SLA contract)
- Chicken-and-egg for ecosystem partners
- Operational complexity (audit, monitoring, RPC, indexer, explorer)
- Risk of being a "ghost chain" if Phase 2 doesn't materialize — biggest risk

---

## 5. EasyGo App Structure (per Figma)

### 5.1 Bottom tab navigation (5 tabs)

1. **Home** — feed, daily check-in, recommended quests
2. **Earn** (highlighted center tab, orange box icon) — quests, ad reward, learning
3. **Stats** — user portfolio, on-chain activity summary
4. **Trade** — Send / Swap (this is where Squid is embedded)
5. **Profile** — avatar, social connections, 🍊 balance, settings

### 5.2 Core flows (from Figma)

- **Login**: Privy email / Kakao social → wallet auto-created
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

- Stored as a counter in Postgres + mirrored as ledger events on EasyChain
- Cannot be withdrawn, traded, or transferred outside the app
- No fiat / crypto conversion guarantee
- Design preserves option to tokenize in Phase 3+ if regulation and product fit allow

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
- Phase 2: avatar marketplace (cosmetic NFT purchases)
- Phase 2+: priority quest access, early alpha drops, premium features

### 6.4 Accounting

- Source of truth: Postgres (idempotent ledger)
- Mirror: EasyChain event log (for transparency and future tokenization migration)
- Anti-abuse: rate limits per action, device fingerprinting, on-chain proof for high-value events

---

## 7. Avatar System

### 7.1 Phase 1 — metadata only

- Default avatar set (7 pixel-art designs from Figma) + 7 background colors
- User selection stored in Postgres user profile
- No NFT minting yet

### 7.2 Phase 2 — NFT marketplace

- Avatars become ERC-721 / 1155 NFTs on EasyChain
- Custom avatars with rarity tiers
- Trade between users with marketplace fee (5–10%)
- 🍊 Orange usable as partial payment

---

## 8. Notifications

Full categorical spec is documented in the Figma EasyGo file (Frame 2147257279) and previously expanded in [RETENTION_PLAN.md](./RETENTION_PLAN.md). Summary:

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
| Wallet address | Privy auto-generated or imported | Yes |
| Email | Privy login | Yes (one of: email/Kakao/Google) |
| Display name | User input or auto-suggested | Yes |
| Avatar | Selected from set (Phase 1) | Yes |
| Telegram handle | OAuth via Telegram Login Widget | Optional (strongly encouraged) |
| X (Twitter) | OAuth | Optional |
| Kakao | OAuth | Optional, Korean-priority |
| ENS name | Read-only display from mainnet | Optional |

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
- Lesson completion proof: lightweight on-chain event on EasyChain (cheap because gas is free / subsidized)
- Reward issuance: 🍊 Orange via backend, mirrored as EasyChain ledger event
- Streak tracking: Postgres + push notification triggers

---

## 11. Revenue Model

### 11.1 EasyGo app revenue (Phase 1, immediate)

| Source | Mechanism | Estimate at MAU 10k |
|---|---|---|
| Swap margin (via Squid) | 0.1–0.3% partner fee on cross-chain swaps | ~$1.5–4.5k / mo |
| Ad reward | "Watch & Earn" — AdMob-style network share, coineasy ~30% | ~$0.5–2k / mo |
| Quest brokerage (early) | Brands fund 🍊 quests, coineasy keeps 30–50% margin | ~$5–20k / mo with 1–3 partners |

### 11.2 EasyChain infrastructure revenue (Phase 2+)

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
| Phase 1 (MVP) | 0–3 mo | ~$5–15k |
| Phase 2 (growth) | 3–9 mo | ~$50–200k |
| Phase 3 (ecosystem) | 9–18 mo | ~$200k–1M |
| Phase 4 (platform) | 18+ mo | $1M+ |

These are working assumptions for sequencing decisions, not forecasts.

---

## 12. Orbis → EasyChain Backend Migration (file-level)

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
- `app.json` FCM config and EAS Update channel `u.expo.dev/92489131-f028-4eb8-96ef-453311e899ec`
- Navigation and state management

### 12.3 New files to add

- `utils/easygo.js` — REST client to EasyGo backend
- `utils/easychain.js` — EasyChain RPC + contract calls
- `utils/squid.js` — Squid SDK wrapper for Send / Swap flows
- `utils/telegram.js` — Telegram Login Widget integration
- `hooks/useOrange.js` — 🍊 balance and earning hook
- `hooks/useEasyChainProfile.js` — profile + social connections

### 12.4 Strategy

- **Clean cutover** for legacy Orbis data — no migration of historical posts. Communicate to existing users with a launch announcement.
- **One PR per major file group** to keep review tractable.

---

## 13. Partnership Open Items

### 13.1 Aurora (Easychain + NEAR Intents)

To raise in Telegram intro / first call:

1. EasyChain monthly fixed cost / sequencer operation model
2. Revenue split for sequencer / "Free Gas" subsidy model
3. NEAR Intents widget availability for embedding in EasyGo (Phase 2)
4. Solver network introduction (which solvers cover EasyChain pairs)
5. Aurora marketing / BD support for ecosystem partner recruitment
6. Chain owner governance scope and upgrade process
7. SLA, uptime guarantees, escape hatch / data export rights
8. Korean-language documentation and support

### 13.2 Squid (cross-chain layer)

Existing Telegram group chat with Squid team. Lead: **TBD** (assign in next standup). To raise:

1. EasyChain (Aurora Virtual Chain on NEAR, EVM-compat) route addition — chain ID coming from Aurora
2. Lazy Liquidity pattern support — settle on external chains, record receipt on EasyChain
3. Squid widget embed in EasyGo — iframe / SDK, Korean language, mobile (Expo RN) compatibility
4. Formal route registration timeline once we seed liquidity
5. Fee model — partner fee share / volume rebate, given coineasy is an existing customer
6. Joint launch case study / co-marketing opportunity
7. Failover / fallback if a route is unavailable mid-transaction

### 13.3 Privy

- Confirm Korean / Kakao social login support and pricing tier
- Confirm React Native Expo SDK feature parity
- Confirm long-term roadmap stability

---

## 14. Roadmap

### Phase 0 — Partnerships (0–4 weeks)

- [ ] Aurora Cloud meeting (Telegram handoff currently pending)
- [ ] Squid kickoff in existing Telegram group
- [ ] Privy plan confirmation
- [ ] Decide Korean entity / privacy policy posture

### Phase 1 — MVP (4–10 weeks)

- [ ] Repo rebrand: coineasy-app → EasyGo (assets, package name, app config)
- [ ] Remove Orbis (per §12)
- [ ] Stand up EasyGo backend (Node + Postgres) and EasyChain client integration
- [ ] Squid Send / Swap flow live (Lazy Liquidity)
- [ ] Privy login + Telegram OAuth
- [ ] 🍊 Orange ledger + daily check-in
- [ ] Notification system per §8 (Expo + Telegram Bot)
- [ ] Pixel avatar selection (metadata only)
- [ ] Closed beta (100–500 Korean users)

### Phase 2 — Growth (3–9 months)

- [ ] Public launch
- [ ] First 1–3 brand quest partners
- [ ] Avatar NFT market (mint + trade)
- [ ] Native DEX with 🍊 LP incentives
- [ ] Squid formal route registration on EasyChain
- [ ] NEAR Intents widget integration evaluation
- [ ] Telegram targeted messaging product (opt-in only)
- [ ] On-chain insight reports (anonymized)

### Phase 3 — Ecosystem (9–18 months)

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
| Aurora Cloud (EasyChain) | ✅ Adopt | NEAR-backed, enterprise model, our chain |
| Privy | ✅ Adopt | $40M+ funded, wallet infra standard, Korean-friendly |
| Squid | ✅ Adopt (Phase 1 main) | Existing customer; Axelar-backed; mature |
| NEAR Intents | ✅ Adopt (Phase 2) | NEAR Foundation operated; Aurora-native |
| Expo / EAS | ✅ Keep | Industry-standard RN tooling |
| Telegram Bot API | ✅ Adopt | Free, permanent, fits Korean user behavior |
| Alchemy / Covalent | ✅ Adopt | Multi-year stable on-chain data infra |
| Supabase / Postgres | ✅ Adopt | Open-source backed, self-host exit possible |
| FCM / Expo Push | ✅ Keep | Already integrated |
| Orbis | ❌ Remove | Service shutting down |
| Farcaster Hubs / Frames | ❌ Skip | Audience mismatch with Korean users |
| EFP / EthID | ❌ Skip Phase 1 | Overkill; reconsider Phase 3+ |
| Lens Protocol | ❌ Skip | Ecosystem mismatch |
| Solana / Sui | ❌ Skip | Codebase rewrite cost; identity stack reset |
| Self-issued token (Phase 1) | ❌ Skip | Regulatory risk; defer to Phase 3+ |

---

## Document changelog

- v1 (initial draft): consolidates decisions from chat sessions on Orbis migration, EthID/Easychain rearchitecture, retention plan, chain selection, social graph evaluation, Korean user targeting, Squid vs NEAR Intents, liquidity bootstrap, sequencer revenue, internal/external tone separation. Supersedes MIGRATION_PLAN.md (PR #1).
