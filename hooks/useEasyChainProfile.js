// hooks/useEasyChainProfile.js
// Hook for EasyChain on-chain profile (avatar, handle, social IDs).
// Phase 1: backend-DB profile via /auth/me (no NFT, no on-chain reads).
// Phase 2: ERC-721 avatar NFT on EasyChain — gated by isEasyChainReady().
// See EASYGO_BUILD_PLAN.md §7 (profile model) and §11.

import { useState, useEffect, useCallback } from 'react';
import { useDeviceAccountOperationLease } from '../contexts/DeviceAccountDataContext';
import { isEasyChainReady, PROFILE_REGISTRY_ADDRESS } from '../utils/easychain';
import { PHASE } from '../utils/easygo';
import { api, ApiError } from '../utils/api';
import { adaptEasyGoProfileResponse } from './easyChainProfileAdapter.mjs';

const EMPTY_PROFILE_STATE = Object.freeze({
  profile: null,
  loading: false,
  error: null,
  lease: null,
});

function sameLease(left, right) {
  return Boolean(
    left
    && right
    && left.ownerUserId === right.ownerUserId
    && left.sessionEpoch === right.sessionEpoch
  );
}

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

export function useEasyChainProfile(address) {
  const { lease, isCurrentLease } = useDeviceAccountOperationLease();
  const [state, setState] = useState(EMPTY_PROFILE_STATE);

  const refresh = useCallback(async () => {
    const expectedLease = lease;
    if (!address || !expectedLease || !isCurrentLease(expectedLease)) return null;

    setState((current) => (
      isCurrentLease(expectedLease)
        ? {
            profile: null,
            loading: true,
            error: null,
            lease: expectedLease,
          }
        : current
    ));
    try {
      if (PHASE.AVATAR_NFT_ENABLED && isEasyChainReady()) {
        // Phase 2 path — read from PROFILE_REGISTRY_ADDRESS via getEasyChainProvider()
        // const reg = new Contract(PROFILE_REGISTRY_ADDRESS, PROFILE_ABI, provider);
        // const uri = await reg.getProfile(address);
        // const meta = await fetch(resolveIpfs(uri)).then(r => r.json());
        // setProfile(meta);
        if (!isCurrentLease(expectedLease)) return null;
        setState((current) => (
          isCurrentLease(expectedLease)
            ? { ...current, profile: null, lease: expectedLease }
            : current
        ));
        return null;
      }
      // Phase 1 path — read from EasyGo backend
      const response = await api.me({
        expectedAuthUserId: expectedLease.ownerUserId,
      });
      if (!isCurrentLease(expectedLease)) return null;
      const profile = adaptEasyGoProfileResponse(response);
      setState((current) => (
        isCurrentLease(expectedLease)
          ? { ...current, profile, error: null, lease: expectedLease }
          : current
      ));
      return profile;
    } catch (e) {
      if (!isCurrentLease(expectedLease)) return null;
      if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
        setState((current) => (
          isCurrentLease(expectedLease)
            ? { ...current, profile: null, error: null, lease: expectedLease }
            : current
        ));
      } else {
        setState((current) => (
          isCurrentLease(expectedLease)
            ? { ...current, error: e, lease: expectedLease }
            : current
        ));
      }
      return null;
    } finally {
      setState((current) => (
        isCurrentLease(expectedLease) && sameLease(current.lease, expectedLease)
          ? { ...current, loading: false }
          : current
      ));
    }
  }, [address, isCurrentLease, lease]);

  useEffect(() => {
    if (!address || !lease) {
      setState(EMPTY_PROFILE_STATE);
      return;
    }
    void refresh();
  }, [address, lease, refresh]);

  const updateProfile = useCallback(async (patch) => {
    // Phase 1: backend profile update endpoint not yet exposed (welcome-only path).
    // Phase 2: upload metadata to IPFS, then call setProfile(uri) on PROFILE_REGISTRY.
    console.warn('[easychain-profile] update not yet wired (Phase 1 read-only)', { address, patch });
    return null;
  }, [address]);

  const ownsState = sameLease(state.lease, lease);

  return {
    profile: ownsState ? state.profile : null,
    loading: ownsState ? state.loading : false,
    error: ownsState ? state.error : null,
    refresh,
    updateProfile,
    isAvatarNftEnabled: PHASE.AVATAR_NFT_ENABLED, // false in Phase 1; true in Phase 2
    registryAddress: PROFILE_REGISTRY_ADDRESS,
  };
}
