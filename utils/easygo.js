// utils/easygo.js
// EasyGo app-level utilities (branding, env, feature flags).
// Phase 1 = Base (Path C decision). EasyChain preserved as Phase 2 option.
// See EASYGO_BUILD_PLAN.md §3.0 (Path C) and §12 for context.

export const APP_NAME = 'EasyGo';
export const CHAIN_NAME = 'EasyChain'; // brand narrative; Phase 1 actual chain is Base
export const POINT_NAME = 'Orange';    // 🍊 hype-purpose point system (NOT a token in Phase 1)

// Phase flags — toggled per EASYGO_BUILD_PLAN.md roadmap (§4) and Path C decision (§3.0)
export const PHASE = {
  CURRENT: 1, // 0=pre, 1=MVP-on-Base, 2=ecosystem, 3=tokenize, 4=public chain
  // Path C: EasyChain activation gated by traction criteria (§4.1)
  EASYCHAIN_ENABLED: false,      // Phase 2 (gated)
  AVATAR_NFT_ENABLED: false,     // Phase 2
  NEAR_INTENTS_ENABLED: false,   // Phase 2 (after EasyChain activation)
  ORANGE_TOKENIZED: false,       // Phase 3
  ORANGE_ON_CHAIN_MIRROR: false, // Phase 2 (Postgres remains source of truth)
};

// Phase 1 chain config — Base (L2). EasyChain config lives in utils/easychain.js, gated.
export const PHASE_1_CHAIN = {
  name: 'Base',
  chainId: 8453,
  nativeSymbol: 'ETH',
};

// Feature flags
export const FEATURES = {
  TELEGRAM_AUTH: true,
  KAKAO_AUTH: true,
  PRIVY_EMBEDDED_WALLET: true,
  SQUID_BRIDGE: true,
  EASYCHAIN_PROFILE: false, // gated; flips with EASYCHAIN_ENABLED
};

// Branding (external tone unchanged — EasyChain ecosystem narrative preserved)
export const BRAND = {
  slogan: 'MAKE IT TRUTH',
  tagline: 'GO EASY',
  primaryColor: '#FF7A1A', // Orange
  timezone: 'Asia/Seoul',  // KST per EasyGo Figma spec
};

// Helpers
export function isEasyChainActive() {
  return PHASE.EASYCHAIN_ENABLED === true;
}

// TODO(phase1): wire Privy app id from env
// TODO(phase1): expose getOrangeBalance(address) once §12.3 hooks land (Postgres-backed)
// TODO(phase2): flip EASYCHAIN_ENABLED + populate utils/easychain.js .env when activation gate met
