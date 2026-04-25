// utils/easygo.js
// EasyGo app-level utilities (branding, env, feature flags).
// Phase 1 scaffolding — values populated when Aurora response arrives.
// See EASYGO_BUILD_PLAN.md §12 for context.

export const APP_NAME = 'EasyGo';
export const CHAIN_NAME = 'EasyChain';
export const POINT_NAME = 'Orange'; // 🍊 hype-purpose point system (NOT a token in Phase 1)

// Phase flags — toggled per EASYGO_BUILD_PLAN.md roadmap (§4)
export const PHASE = {
  CURRENT: 1, // 0=pre, 1=MVP, 2=ecosystem, 3=tokenize, 4=public chain
  AVATAR_NFT_ENABLED: false,    // Phase 2
  NEAR_INTENTS_ENABLED: false,  // Phase 2 (waiting on EasyChain liquidity)
  ORANGE_TOKENIZED: false,      // Phase 3
};

// Feature flags
export const FEATURES = {
  TELEGRAM_AUTH: true,
  KAKAO_AUTH: true,
  PRIVY_EMBEDDED_WALLET: true,
  SQUID_BRIDGE: true,
  EASYCHAIN_PROFILE: true,
};

// Branding
export const BRAND = {
  slogan: 'MAKE IT TRUTH',
  tagline: 'GO EASY',
  primaryColor: '#FF7A1A', // Orange
  timezone: 'Asia/Seoul',  // KST per EasyGo Figma spec
};

// TODO(phase1): wire to env once Aurora delivers chain config
// TODO(phase1): expose getOrangeBalance(address) once §12.3 hooks land
