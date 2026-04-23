# Migration Plan: Orbis → Aurora Easychain + EthID Stack

Status: Draft
Owner: @jadenlee7
Target app: coineasy-app (Expo / React Native)
Target infra: Aurora Cloud "Easychain" (EVM virtual chain on NEAR) + Ethereum mainnet (ENS / EFP / SIWE)
External partners to engage: Aurora Cloud team, JustaName (or Namestone / ENS Durin) team

---

## 1. Why migrate

Today the app is tightly coupled to Orbis / Ceramic:

- `@orbisclub/orbis-sdk` (forked: `github:yeloda/orbis-sdk#master`) wraps identity, social graph, feed, and IPFS into one SDK.
- - `App.js` creates a global `Orbis` instance and uses it in ~23 call sites.
  - - `utils/index.js` calls Orbis REST endpoints (`api.orbis.club/get-nfts`, `/get-balance`, `/get-poap-ownership`).
    - - `utils/config.js` holds three Ceramic stream `context` IDs that act as feed namespaces.
      - - `hooks/useDidToAddress`, `useGetUsername`, `useGetMentionedDid` are Ceramic DID helpers.
       
        - Goals of this migration:
       
        - 1. Replace Orbis-as-a-server with a stack we control and that composes with the broader Ethereum ecosystem.
          2. 2. Use Aurora Easychain as the high-throughput, gas-abstracted home for content and interactions.
             3. 3. Use the EthID stack (ENS + EFP + SIWE + Ethereum Identity Kit) for identity and social graph so we do not reinvent these primitives and we inherit network effects from other ENS-native apps.
                4. 4. Keep the mobile UX "Web2-like": no seed phrase friction, no user-visible gas for everyday actions.
                  
                   5. ---
                  
                   6. ## 2. Target architecture (two-layer)
                  
                   7. Layer A — Identity & social graph (Ethereum mainnet, via EthID):
                  
                   8. - ENS for names, avatars, bios, and text records.
                      - - Project 2LD (e.g. `coineasy.eth`) issues subnames like `alice.coineasy.eth` to every user via an ENSIP-10 / CCIP-Read offchain resolver (JustaName, Namestone, or ENS Durin).
                        - - EFP (Ethereum Follow Protocol) for follow / block / mute / tag relationships, queried through the official EFP indexer API.
                          - - SIWE (Sign-In with Ethereum) for session auth. Privy can stay as the wallet/login UX shell and emit SIWE; or Privy is removed and SIWE is used directly.
                            - - Ethereum Identity Kit as the reference for component behavior. Since coineasy-app is React Native, we will not import the web components directly; we will call the same underlying APIs/contracts and render native RN components.
                             
                              - Layer B — Content, interactions, rewards (Aurora Easychain):
                             
                              - - Custom contracts on Easychain for: `ProfileMeta` (optional app-specific profile fields), `Post`, `Comment`, `Reaction` (like/repost), `Reward`, `Shop`, `News`.
                                - - Posts store only `(author, cid, contextId, timestamp)` on-chain; the body/media live on IPFS (Pinata keys can be reused) and are referenced by CID.
                                  - - The three legacy Orbis context IDs in `utils/config.js` are reinterpreted as `bytes32 contextId` constants (e.g. `keccak256("coineasy.main")`, `"coineasy.onboard"`, `"coineasy.edu"`) so feed semantics are preserved.
                                    - - Gas Abstraction on Easychain is enabled (chain config already set to Free), so end users never sign a gas-paying transaction for posting, liking, commenting.
                                     
                                      - Off-chain services:
                                     
                                      - - Indexer for Easychain events (The Graph subgraph on Aurora Cloud, or Goldsky) feeding a read API (REST or GraphQL) the app uses to render feeds.
                                        - - Offchain ENS subname resolver backend (to be run with JustaName or equivalent) for `*.coineasy.eth`.
                                          - - IPFS pinning: keep Pinata or replace with a dedicated pinning service; storage client is abstracted so this is swappable.
                                           
                                            - Composition rule:
                                           
                                            - - Identity question ("who is this?") → Ethereum mainnet via ENS.
                                              - - Relationship question ("do A and B follow each other?") → Ethereum mainnet via EFP API.
                                                - - Content question ("what did A post?", "who liked this?") → Easychain via our indexer.
                                                  - - The app joins these three sources client-side (or via a thin BFF) to render a feed.
                                                   
                                                    - ---

                                                    ## 3. Mapping: Orbis API → new stack

                                                    | Current Orbis usage | New implementation |
                                                    | --- | --- |
                                                    | `new Orbis({...})` in `App.js` | `createCoineasyClient({ identity: ENSClient, social: EFPClient, content: EasychainContentClient, storage: IPFSClient })` |
                                                    | `orbis.isConnected(session)` | SIWE session check (Privy `authenticated` or custom SIWE session cookie) |
                                                    | `orbis.connect_v2(...)` / Ceramic session creation | SIWE sign-in flow, returns session JWT |
                                                    | `orbis.getProfile(did)` | `ens.getName(address)` + `ens.getTextRecords(name)` + optional `ProfileMeta.get(address)` on Easychain |
                                                    | `orbis.updateProfile(...)` | ENS text record updates (mainnet) and/or `ProfileMeta.set(...)` on Easychain |
                                                    | `orbis.getPosts({ context })` | `contentApi.getFeed({ contextId, cursor })` backed by Easychain indexer |
                                                    | `orbis.createPost({ body, context })` | `storage.upload(body)` → `Post.create(cid, contextId)` on Easychain (gas-free) |
                                                    | `orbis.react(postId, type)` | `Reaction.react(postId, kind)` on Easychain |
                                                    | `orbis.setFollow(did, true/false)` | `efp.follow(address)` / `efp.unfollow(address)` on mainnet |
                                                    | `orbis.getFollowers/Following(did)` | EFP API: `GET /users/{addressOrName}/followers` etc. |
                                                    | `utils/index.js` → `api.orbis.club/get-balance` | Easychain RPC: `client.readContract(ERC20, 'balanceOf', [address])` |
                                                    | `utils/index.js` → `api.orbis.club/get-nfts` | Easychain indexer or Aurora Cloud NFT indexer |
                                                    | `utils/index.js` → `api.orbis.club/get-poap-ownership` | Easychain `Reward` contract (app-native badges) or retained POAP integration on mainnet |
                                                    | `utils/config.js` context IDs | `bytes32` constants derived from namespaced strings |
                                                    | `hooks/useDidToAddress` | Remove; identity is already `address` |
                                                    | `hooks/useGetUsername` | `viem.getEnsName(address)` (with CCIP-Read for subnames) |
                                                    | `hooks/useGetMentionedDid` | `viem.getEnsAddress(name)` |

                                                    ---

                                                    ## 4. Phased rollout

                                                    All work happens on the `feat/easychain-ethid-migration` branch; only completed phases merge to `master`.

                                                    Phase 0 — Foundations (this document + agreements)
                                                    - [ ] Finalize partner engagements: Aurora Cloud (deployment + Gas Abstraction + indexer) and JustaName (ENS subname issuance under `coineasy.eth`).
                                                    - [ ] - [ ] Receive Easychain RPC URL, chain ID, block explorer URL from Aurora.
                                                    - [ ] - [ ] Register or confirm `coineasy.eth` 2LD ownership.
                                                    - [ ] - [ ] Decide: keep Privy as wallet shell, or go Privy-less with a pure SIWE + embedded wallet flow.
                                                    - [ ] - [ ] Decide: migrate legacy Orbis data (posts / follows) or start fresh with a cutover date.
                                                   
                                                    - [ ] Phase 1 — Scaffolding (no behavior change)
                                                    - [ ] - [ ] Add `viem`, SIWE client, EFP client, IPFS client dependencies in a `clients/` directory.
                                                    - [ ] - [ ] Add `config/chains.ts` with Easychain viem chain definition (filled in once Aurora values arrive).
                                                    - [ ] - [ ] Add `MIGRATION_PLAN.md` (this file) and `docs/architecture.md`.
                                                    - [ ] - [ ] Keep Orbis SDK in place; new clients coexist behind a feature flag `USE_NEW_STACK=false`.
                                                   
                                                    - [ ] Phase 2 — Identity & auth
                                                    - [ ] - [ ] Integrate SIWE sign-in; issue session JWT from a thin backend.
                                                    - [ ] - [ ] Integrate ENS primary-name + avatar + text record lookups; replace `useDidToAddress`, `useGetUsername`, `useGetMentionedDid`.
                                                    - [ ] - [ ] Integrate JustaName-powered subname issuance on first login (`<handle>.coineasy.eth`).
                                                   
                                                    - [ ] Phase 3 — Social graph
                                                    - [ ] - [ ] Integrate EFP read API for followers / following / mutuals.
                                                    - [ ] - [ ] Implement follow / unfollow via EFP contract calls from the app (with mainnet gas UX considerations: sponsored tx or clear user consent).
                                                   
                                                    - [ ] Phase 4 — Content on Easychain
                                                    - [ ] - [ ] Design and deploy `Post`, `Comment`, `Reaction`, `ProfileMeta`, `Reward` contracts on Easychain.
                                                    - [ ] - [ ] Stand up indexer (The Graph subgraph on Aurora Cloud) + content read API.
                                                    - [ ] - [ ] Implement `storage.upload()` + `Post.create(cid, contextId)` pipeline with Gas Abstraction.
                                                    - [ ] - [ ] Replace feed rendering to read from content API + join with EFP following set.
                                                   
                                                    - [ ] Phase 5 — Onchain data reads
                                                    - [ ] - [ ] Replace `utils/index.js` Orbis REST calls (`get-balance`, `get-nfts`, `get-poap-ownership`) with direct Easychain RPC / Aurora Cloud indexer.
                                                   
                                                    - [ ] Phase 6 — Shop / News / Rewards
                                                    - [ ] - [ ] Port shop and news features to `Shop` and `News` contracts + content API.
                                                    - [ ] - [ ] Port reward logic to `Reward` contract; decide whether POAP integration on mainnet remains.
                                                   
                                                    - [ ] Phase 7 — Cutover & cleanup
                                                    - [ ] - [ ] Flip `USE_NEW_STACK=true` in staging; dogfood.
                                                    - [ ] - [ ] Remove `@orbisclub/orbis-sdk`, `utils/config.js` Ceramic IDs, Ceramic-DID hooks, all Orbis call sites.
                                                    - [ ] - [ ] Release new app version; communicate migration to users.
                                                   
                                                    - [ ] ---
                                                   
                                                    - [ ] ## 5. Code-level impact (first pass)
                                                   
                                                    - [ ] Files that will change:
                                                   
                                                    - [ ] - `package.json`: remove `@orbisclub/orbis-sdk`; add `viem`, `@siwe/siwe` (or Privy SIWE), EFP client, IPFS client.
                                                    - [ ] - `App.js` (1121 lines, 23 Orbis call sites): replace global `Orbis` instance with composite `CoineasyClient`; rewrite each call site per the mapping table.
                                                    - [ ] - `utils/config.js`: replace Ceramic stream IDs with `bytes32` context constants.
                                                    - [ ] - `utils/index.js`: replace `api.orbis.club/*` calls with Easychain RPC / indexer calls.
                                                    - [ ] - `contexts/GlobalContext.js`: `orbis: null` → `client: null` (composite client) and `user: null` stays.
                                                    - [ ] - `hooks/useDidToAddress.js`, `hooks/useGetUsername.js`, `hooks/useGetMentionedDid.js`: rewrite against ENS, or remove.
                                                    - [ ] - `screens/*`: update profile, feed, follow, shop, news, reward screens to use the new clients.
                                                    - [ ] - New files: `clients/identity.ts`, `clients/social.ts`, `clients/content.ts`, `clients/storage.ts`, `config/chains.ts`, `contracts/` (Solidity), `indexer/` (subgraph manifest).
                                                   
                                                    - [ ] Files unlikely to change: `tailwind.*`, navigation skeleton, asset pipeline.
                                                   
                                                    - [ ] ---
                                                   
                                                    - [ ] ## 6. Open questions to resolve with partners
                                                   
                                                    - [ ] For Aurora Cloud:
                                                   
                                                    - [ ] - Easychain RPC URL, chain ID, block explorer URL, WebSocket endpoint.
                                                    - [ ] - Gas Abstraction policy: who pays, rate limits per user, abuse controls.
                                                    - [ ] - Recommended indexer path on Aurora Cloud (subgraph hosting vs external Goldsky).
                                                    - [ ] - NFT / token indexer availability on Easychain (replacement for `get-nfts`).
                                                    - [ ] - Bridge and Near Intents integration specifics for asset flows.
                                                    - [ ] - Deployment timeline post-Telegram handoff.
                                                   
                                                    - [ ] For JustaName (or Namestone / ENS Durin):
                                                   
                                                    - [ ] - Hosted offchain resolver for `*.coineasy.eth` subnames via CCIP-Read.
                                                    - [ ] - Subname issuance API (create on first SIWE login), update flow (avatar / bio text records), revocation policy.
                                                    - [ ] - Cost model per subname / per MAU.
                                                    - [ ] - Data residency / backup guarantees for the resolver backend.
                                                    - [ ] - Optional: migration path from hosted offchain subnames to fully onchain subnames later (L2 or mainnet) without breaking existing names.
                                                   
                                                    - [ ] For ENS / EFP ecosystem:
                                                   
                                                    - [ ] - EFP API rate limits and self-hosting option if we outgrow public endpoints.
                                                    - [ ] - Sponsored-tx / relayer options for EFP writes (so mainnet gas does not land on end users).
                                                    - [ ] - Expected EFP L2 support roadmap, if any, that would let follows happen off mainnet.
                                                   
                                                    - [ ] ---
                                                   
                                                    - [ ] ## 7. Non-goals (for now)
                                                   
                                                    - [ ] - Full decentralization of the indexer. V1 runs an operator-managed indexer; we revisit decentralization later.
                                                    - [ ] - Preserving Orbis DID identifiers as primary keys. Users are keyed by EVM address and their ENS name.
                                                    - [ ] - Cross-posting back to Orbis / Ceramic for legacy clients.
                                                    - [ ] - Custom L2 beyond Easychain.
                                                   
                                                    - [ ] ---
                                                   
                                                    - [ ] ## 8. Risks
                                                   
                                                    - [ ] - Mainnet gas for EFP writes may hurt UX; mitigation: relayers or batching, and clear "this lives on Ethereum" messaging.
                                                    - [ ] - Offchain ENS resolver is a single point of failure until names are promoted onchain; mitigation: backups + exportable registry state.
                                                    - [ ] - Easychain deployment timing is gated by the Aurora Telegram handoff; Phase 1 scaffolding can proceed in parallel.
                                                    - [ ] - Data migration from Orbis is non-trivial; acceptable to cutover with a clean slate if product decides.
                                                    - [ ] 
