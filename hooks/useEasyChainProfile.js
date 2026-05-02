// hooks/useEasyChainProfile.js
// Hook for EasyChain on-chain profile (avatar, handle, social IDs).
// Phase 1: backend-DB profile via /auth/me (no NFT, no on-chain reads).
// Phase 2: ERC-721 avatar NFT on EasyChain — gated by isEasyChainReady().
// See EASYGO_BUILD_PLAN.md §7 (profile model) and §11.

import { useState, useEffect, useCallback } from 'react';
import { isEasyChainReady, PROFILE_REGISTRY_ADDRESS } from '../utils/easychain';
import { PHASE } from '../utils/easygo';
import { api, ApiError } from '../utils/api';

// ---------------------------------------------------------------------------
// Profile shape (Phase 1, backend-DB):
// {
//   address: '0x...',
//   handle: 'jaden',
//   avatarUri: 'ipfs://...' | null,
//   socials: { telegram: '@jaden', twitter: '...', kakao: '...' },
//   joinedAt: 1745625600,
// }
// ---------------------------------------------------------------------------

function adaptBackendUser(me) {
  if (!me) return null;
  return {
    address: me.address ?? null,
    handle: me.handle ?? null,
    avatarUri: me.avatarUri ?? null,
    socials: {
      telegram: me.telegramId ?? null,
      kakao: me.kakaoId ?? null,
      twitter: me.twitterId ?? null,
    },
    joinedAt: me.createdAt ?? null,
  };
}

export function useEasyChainProfile(address) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      if (PHASE.AVATAR_NFT_ENABLED && isEasyChainReady()) {
        // Phase 2 path — read from PROFILE_REGISTRY_ADDRESS via getEasyChainProvider()
        // const reg = new Contract(PROFILE_REGISTRY_ADDRESS, PROFILE_ABI, provider);
        // const uri = await reg.getProfile(address);
        // const meta = await fetch(resolveIpfs(uri)).then(r => r.json());
        // setProfile(meta);
        setProfile(null);
        return;
      }
      // Phase 1 path — read from EasyGo backend
      const me = await api.me();
      setProfile(adaptBackendUser(me));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
        setProfile(null);
      } else {
        setError(e);
      }
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  const updateProfile = useCallback(async (patch) => {
    // Phase 1: backend profile update endpoint not yet exposed (welcome-only path).
    // Phase 2: upload metadata to IPFS, then call setProfile(uri) on PROFILE_REGISTRY.
    console.warn('[easychain-profile] update not yet wired (Phase 1 read-only)', { address, patch });
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
