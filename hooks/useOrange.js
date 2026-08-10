// hooks/useOrange.js
// Hook for 🍊 Orange — hype-purpose point system (NOT a token in Phase 1).
// See EASYGO_BUILD_PLAN.md §5 (reward economy) and §11 (Orange ledger).
// Phase 1: Postgres-backed ledger via EasyGo backend (POST/GET /orange/*).

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDeviceAccountOperationLease } from '../contexts/DeviceAccountDataContext';
import { POINT_NAME, PHASE } from '../utils/easygo';
import { api, ApiError } from '../utils/api';

const EMPTY_ORANGE_STATE = Object.freeze({
  balance: 0,
  history: Object.freeze([]),
  loading: false,
  ready: false,
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
// useOrange — read balance + history; earn is server-driven in Phase 1
// (backend auto-rewards on /auth/sync welcome bonus and /swap/log)
// ---------------------------------------------------------------------------
export function useOrange(address) {
  const { lease, isCurrentLease } = useDeviceAccountOperationLease();
  const [state, setState] = useState(EMPTY_ORANGE_STATE);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const expectedLease = lease;
    if (!address || !expectedLease || !isCurrentLease(expectedLease)) return null;
    const requestId = ++requestIdRef.current;
    const isCurrentRequest = () => (
      requestId === requestIdRef.current
      && isCurrentLease(expectedLease)
    );

    setState((current) => (
      isCurrentRequest()
        ? {
            ...(sameLease(current.lease, expectedLease) ? current : EMPTY_ORANGE_STATE),
            loading: true,
            ready: false,
            error: null,
            lease: expectedLease,
          }
        : current
    ));
    try {
      const [balRes, histRes] = await Promise.all([
        api.orangeBalance(address, {
          expectedAuthUserId: expectedLease.ownerUserId,
        }),
        api.orangeHistory(address, {
          limit: 50,
          expectedAuthUserId: expectedLease.ownerUserId,
        }),
      ]);
      if (!isCurrentRequest()) return null;

      // balRes shape (Phase 1 backend): { balance: number }
      // histRes shape: { rows: [{ delta, reason, createdAt }, ...] }
      setState((current) => {
        if (!isCurrentRequest()) return current;
        return {
          balance: balRes?.balance ?? 0,
          history: histRes?.rows ?? [],
          loading: true,
          ready: Boolean(balRes || histRes),
          error: null,
          lease: expectedLease,
        };
      });
      return { balance: balRes, history: histRes };
    } catch (e) {
      if (!isCurrentRequest()) return null;
      if (e instanceof ApiError && e.status === 404) {
        // New user not yet synced — treat as zero balance, not an error
        setState((current) => {
          if (!isCurrentRequest()) return current;
          return {
            balance: 0,
            history: [],
            loading: true,
            ready: true,
            error: null,
            lease: expectedLease,
          };
        });
      } else {
        setState((current) => (
          isCurrentRequest()
            ? { ...current, error: e, lease: expectedLease }
            : current
        ));
      }
      return null;
    } finally {
      setState((current) => (
        isCurrentRequest() && sameLease(current.lease, expectedLease)
          ? { ...current, loading: false }
          : current
      ));
    }
  }, [address, isCurrentLease, lease]);

  useEffect(() => {
    requestIdRef.current += 1;
    if (!address || !lease) {
      setState(EMPTY_ORANGE_STATE);
      return undefined;
    }
    void refresh();
    return () => { requestIdRef.current += 1; };
  }, [address, lease, refresh]);

  // Phase 1: client cannot mint Orange directly. Earning happens server-side
  // (welcome bonus on /auth/sync, +10 🍊 per logged swap, etc.). This stub is
  // kept for API stability with screens that already call earn().
  const earn = useCallback(async ({ amount, reason }) => {
    console.warn('[orange] client-side earn is a no-op in Phase 1; backend awards automatically', { amount, reason });
    return null;
  }, []);

  const ownsState = sameLease(state.lease, lease);

  return {
    pointName: POINT_NAME,        // 🍊 Orange
    balance: ownsState ? state.balance : 0,
    history: ownsState ? state.history : [],
    loading: ownsState ? state.loading : false,
    ready: ownsState ? state.ready : false,
    error: ownsState ? state.error : null,
    refresh,
    earn,
    isTokenized: PHASE.ORANGE_TOKENIZED, // false in Phase 1; true in Phase 3
  };
}
