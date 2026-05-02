// utils/easychain.js
// EasyChain (Aurora-based app-chain) network config + provider helpers.
// Phase 1 scaffolding — Aurora delivers RPC URL / chain ID / explorer URL.
// See EASYGO_BUILD_PLAN.md §13.1 (Aurora Cloud agenda).

// ---------------------------------------------------------------------------
// Network config (env-driven; populated when Aurora response arrives)
// ---------------------------------------------------------------------------
export const EASYCHAIN_CONFIG = {
  chainId: Number(process.env.EXPO_PUBLIC_EASYCHAIN_CHAIN_ID) || 0,         // TODO(aurora)
  rpcUrl: process.env.EXPO_PUBLIC_EASYCHAIN_RPC_URL || '',                   // TODO(aurora)
  explorerUrl: process.env.EXPO_PUBLIC_EASYCHAIN_EXPLORER_URL || '',         // TODO(aurora)
  nativeSymbol: process.env.EXPO_PUBLIC_EASYCHAIN_NATIVE_SYMBOL || 'ETH',    // gas-abstracted in Phase 1
  freeGas: true, // Aurora Free Gas; user never pays
};

// ---------------------------------------------------------------------------
// Provider — lazy singleton; falls back to no-op until env wired
// ---------------------------------------------------------------------------
let _provider = null;

export function getEasyChainProvider() {
  if (_provider) return _provider;
  if (!EASYCHAIN_CONFIG.rpcUrl) {
    // Phase 1 scaffolding: Aurora response not yet wired
    console.warn('[easychain] RPC URL not configured; returning null provider');
    return null;
  }
  // TODO(phase1): replace with ethers.JsonRpcProvider once Aurora chain config arrives
  // _provider = new JsonRpcProvider(EASYCHAIN_CONFIG.rpcUrl, EASYCHAIN_CONFIG.chainId);
  return _provider;
}

// ---------------------------------------------------------------------------
// Profile registry (on-chain JSON metadata pointer per address)
// Phase 1: metadata-only; Phase 2: avatar NFT (ERC-721)
// ---------------------------------------------------------------------------
export const PROFILE_REGISTRY_ADDRESS = process.env.EXPO_PUBLIC_EASYCHAIN_PROFILE_REGISTRY || ''; // TODO(deploy)

// TODO(phase1): export setProfile(address, metadataUri), getProfile(address)
// TODO(phase2): export mintAvatarNFT(address, tokenUri) when AVATAR_NFT_ENABLED

export function isEasyChainReady() {
  return Boolean(EASYCHAIN_CONFIG.rpcUrl && EASYCHAIN_CONFIG.chainId);
}
