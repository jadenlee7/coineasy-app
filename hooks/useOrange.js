// hooks/useOrange.js
// Hook for 🍊 Orange — hype-purpose point system (NOT a token in Phase 1).
// See EASYGO_BUILD_PLAN.md §5 (reward economy) and §11 (Orange ledger).
// Phase 1: Postgres-backed ledger via EasyGo backend (POST/GET /orange/*).

import { useState, useEffect, useCallback } from 'react';
import { POINT_NAME, PHASE } from '../utils/easygo';
import { api, ApiError } from '../utils/api';

// ---------------------------------------------------------------------------
// useOrange — read balance + history; earn is server-driven in Phase 1
// (backend auto-rewards on /auth/sync welcome bonus and /swap/log)
// ---------------------------------------------------------------------------
export function useOrange(address) {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const [balRes, histRes] = await Promise.all([
        api.orangeBalance(address),
        api.orangeHistory(address, { limit: 50 }),
      ]);
      // balRes shape (Phase 1 backend): { address, balance: number }
      setBalance(balRes?.balance ?? 0);
      // histRes shape: { entries: [{ amount, reason, createdAt }, ...] }
      setHistory(histRes?.entries ?? []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // New user not yet synced — treat as zero balance, not an error
        setBalance(0);
        setHistory([]);
      } else {
        setError(e);
      }
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  // Phase 1: client cannot mint Orange directly. Earning happens server-side
  // (welcome bonus on /auth/sync, +10 🍊 per logged swap, etc.). This stub is
  // kept for API stability with screens that already call earn().
  const earn = useCallback(async ({ amount, reason }) => {
    console.warn('[orange] client-side earn is a no-op in Phase 1; backend awards automatically', { amount, reason });
    return null;
  }, []);

  return {
    pointName: POINT_NAME,        // 🍊 Orange
    balance,
    history,
    loading,
    error,
    refresh,
    earn,
    isTokenized: PHASE.ORANGE_TOKENIZED, // false in Phase 1; true in Phase 3
  };
}
