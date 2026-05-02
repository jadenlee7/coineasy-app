// hooks/useEasyChainProfile.js
// Hook for EasyChain on-chain profile (avatar, handle, social IDs).
// Phase 1: metadata-only (no NFT). Phase 2: ERC-721 avatar NFT.
// See EASYGO_BUILD_PLAN.md §7 (profile model) and §11.

import { useState, useEffect, useCallback } from 'react';
import { isEasyChainReady, PROFILE_REGISTRY_ADDRESS } from '../utils/easychain';
import { PHASE } from '../utils/easygo';

// ---------------------------------------------------------------------------
// Profile shape (Phase 1)
// ---------------------------------------------------------------------------
// {
//   address: '0x...',
//   handle: 'jaden',           // unique
//   avatarUri: 'ipfs://...',   // pixel avatar (Figma spec)
//   socials: { telegram: '@jaden', twitter: '...', kakao: '...' },
//   joinedAt: 1745625600,
// }

export function useEasyChainProfile(address) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    if (!isEasyChainReady()) {
      // Aurora chain config not yet wired
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // TODO(phase1): read from PROFILE_REGISTRY_ADDRESS via getEasyChainProvider()
      // const reg = new Contract(PROFILE_REGISTRY_ADDRESS, PROFILE_ABI, provider);
      // const uri = await reg.getProfile(address);
      // const meta = await fetch(resolveIpfs(uri)).then(r => r.json());
      // setProfile(meta);
      setProfile(null); // scaffolding default
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateProfile = useCallback(async (patch) => {
    // TODO(phase1): upload metadata to IPFS, then call setProfile(uri) on PROFILE_REGISTRY
    console.warn('[easychain-profile] update not yet wired', { address, patch });
    return null;
  }, [address]);

  return {
    profile,
    loading,
    error,
    refresh,
    updateProfile,
    isAvatarNftEnabled: PHASE.AVATAR_NFT_ENABLED, // false in Phase 1; true in Phase 2
    registryAddress: PROFILE_REGISTRY_ADDRESS,
  };
}
