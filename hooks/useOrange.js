// hooks/useOrange.js
// Hook for 🍊 Orange — hype-purpose point system (NOT a token in Phase 1).
// See EASYGO_BUILD_PLAN.md §5 (reward economy) and §11 (Orange ledger).

import { useState, useEffect, useCallback } from 'react';
import { POINT_NAME, PHASE } from '../utils/easygo';

// ---------------------------------------------------------------------------
// useOrange — read + earn + (Phase 3) tokenize Orange points
// ---------------------------------------------------------------------------
export function useOrange(address) {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      // TODO(phase1): GET /api/orange/balance?address=<addr> from EasyGo backend
      // const res = await fetch(`/api/orange/balance?address=${address}`);
      // const data = await res.json();
      // setBalance(data.balance);
      setBalance(0); // scaffolding default
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const earn = useCallback(async ({ amount, reason }) => {
    // TODO(phase1): POST /api/orange/earn { address, amount, reason }
    console.warn('[orange] earn not yet wired', { address, amount, reason });
    return null;
  }, [address]);

  return {
    pointName: POINT_NAME, // 🍊 Orange
    balance,
    loading,
    error,
    refresh,
    earn,
    isTokenized: PHASE.ORANGE_TOKENIZED, // false in Phase 1; true in Phase 3
  };
}
