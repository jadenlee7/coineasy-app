import { useCallback, useEffect, useState } from 'react';
import { useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';

import {
  attestBaseWalletRuntime,
  normalizeEvmAddress,
} from '../utils/baseWalletRuntime.mjs';

const IDLE_RUNTIME = Object.freeze({ status: 'idle', chainId: null });

export default function useEasyGoWalletRuntime({
  enabled = true,
  expectedAddress = null,
} = {}) {
  const privy = usePrivy();
  const { wallets = [] } = useEmbeddedEthereumWallet();
  const [runtime, setRuntime] = useState(IDLE_RUNTIME);
  const [probeVersion, setProbeVersion] = useState(0);

  const normalizedExpected = normalizeEvmAddress(expectedAddress);
  const wallet = wallets.find(
    (candidate) => normalizeEvmAddress(candidate?.address) === normalizedExpected,
  ) || wallets[0] || null;
  const walletIdentity = wallet
    ? `${normalizeEvmAddress(wallet.address) || 'invalid'}:${wallet.walletIndex ?? 0}`
    : 'missing';
  const ready = Boolean(privy?.isReady);
  const userId = privy?.user?.id ?? null;

  const refresh = useCallback(() => {
    setProbeVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let provider = null;
    let listenersAttached = false;

    if (!enabled || !ready || !userId) {
      setRuntime(IDLE_RUNTIME);
      return () => { active = false; };
    }

    if (!wallet) {
      setRuntime({ status: 'wallet-missing', chainId: null });
      return () => { active = false; };
    }

    const probe = async () => {
      if (!provider || !active) return;
      try {
        const [chainId, accounts] = await Promise.all([
          provider.request({ method: 'eth_chainId' }),
          provider.request({ method: 'eth_accounts' }),
        ]);
        if (!active) return;
        setRuntime(attestBaseWalletRuntime({
          chainId,
          accounts,
          walletAddress: wallet.address,
          expectedAddress: normalizedExpected,
        }));
      } catch {
        if (active) setRuntime({ status: 'error', chainId: null });
      }
    };

    const handleRuntimeChange = () => {
      void probe();
    };

    setRuntime({ status: 'checking', chainId: null });
    void (async () => {
      try {
        provider = await wallet.getProvider();
        if (!active) return;
        await probe();
        if (!active) return;
        provider.on?.('chainChanged', handleRuntimeChange);
        provider.on?.('accountsChanged', handleRuntimeChange);
        listenersAttached = true;
      } catch {
        if (active) setRuntime({ status: 'error', chainId: null });
      }
    })();

    return () => {
      active = false;
      if (!provider || !listenersAttached) return;
      provider.removeListener?.('chainChanged', handleRuntimeChange);
      provider.removeListener?.('accountsChanged', handleRuntimeChange);
    };
  }, [enabled, normalizedExpected, probeVersion, ready, userId, walletIdentity]);

  return {
    ...runtime,
    walletAddress: wallet?.address ?? null,
    refresh,
  };
}
