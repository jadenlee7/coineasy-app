// hooks/useSocialProfile.js
//
// Viewer-relative profile lookup hook for **other users** (read-only).
// Wired to EasyGo backend via api.profiles.get(userId).
//
// Note: this is intentionally distinct from useEasyChainProfile, which
// owns the *current authenticated user's* profile (private fields + edit
// via /profiles/me). useSocialProfile only exposes public projection.
//
// PR #13 wired this. Backend models/routes shipped in PR #9; api client
// helpers shipped in PR #10.

import { useCallback, useEffect, useRef, useState } from "react";
import { useDeviceAccountOperationLease } from "../contexts/DeviceAccountDataContext";
import { api } from "../utils/api";

/**
 * Fetch a public profile by user id (cuid).
 *
 * @param {string|null|undefined} userId - target user's cuid; nullish disables fetch
 * @returns {{
 *   profile: object|null,
 *   loading: boolean,
 *   error: Error|null,
 *   refresh: () => Promise<object|null>,
 *   update: () => Promise<null>,  // deprecated no-op; see header
 * }}
 */
export function useSocialProfile(userId) {
  const { lease, isCurrentLease } = useDeviceAccountOperationLease();
  const [state, setState] = useState({
    targetUserId: null,
    profile: null,
    loading: false,
    error: null,
  });

  // Guard against state updates after unmount or stale userId changes.
  const reqIdRef = useRef(0);
  const liveUserIdRef = useRef(userId);
  const liveLeaseRef = useRef(lease);
  liveUserIdRef.current = userId;
  liveLeaseRef.current = lease;

  const refresh = useCallback(async () => {
    const targetUserId = userId;
    const operationLease = lease;
    const myReq = ++reqIdRef.current;
    const isCurrentRequest = () => (
      myReq === reqIdRef.current
      && liveUserIdRef.current === targetUserId
      && liveLeaseRef.current === operationLease
      && isCurrentLease(operationLease)
    );

    if (!targetUserId || !operationLease || !isCurrentLease(operationLease)) {
      setState({ targetUserId, profile: null, loading: false, error: null });
      return null;
    }
    setState({ targetUserId, profile: null, loading: true, error: null });
    try {
      const res = await api.profiles.get(targetUserId, {
        expectedAuthUserId: operationLease.ownerUserId,
      });
      // api.profiles.get returns null when EXPO_PUBLIC_BACKEND_URL is unset
      // (see utils/api.js helper contract). Treat that as "no data, no error".
      if (!isCurrentRequest()) return null;
      const next = res && typeof res === "object" ? (res.profile ?? res) : null;
      setState({ targetUserId, profile: next, loading: false, error: null });
      return next;
    } catch (e) {
      if (!isCurrentRequest()) return null;
      setState({
        targetUserId,
        profile: null,
        loading: false,
        error: e instanceof Error ? e : new Error(String(e)),
      });
      return null;
    }
  }, [isCurrentLease, lease, userId]);

  // Auto-fetch on mount / when userId changes.
  useEffect(() => {
    refresh();
    return () => {
      // Invalidate any in-flight request from previous userId.
      reqIdRef.current += 1;
    };
  }, [refresh]);

  // Deprecated: other users' profiles cannot be edited via this hook.
  // Kept as a no-op for callsite compatibility during the Orbis -> EasyGo
  // migration. Use useEasyChainProfile.updateMe for self-profile edits.
  const update = useCallback(async (_payload) => {
    if (__DEV__) {
      console.warn(
        "[useSocialProfile] update() is a no-op; use useEasyChainProfile for self-profile edits."
      );
    }
    return null;
  }, []);

  const ownsTarget = state.targetUserId === userId;
  return {
    profile: ownsTarget ? state.profile : null,
    loading: ownsTarget ? state.loading : Boolean(userId),
    error: ownsTarget ? state.error : null,
    refresh,
    update,
  };
}

export default useSocialProfile;
