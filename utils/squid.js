// utils/squid.js
// Squid Router integration (cross-chain bridge for EasyGo Phase 1).
// Phase 1: client delegates quote + log to backend (/swap/quote, /swap/log).
// Backend uses @0xsquid/sdk server-side; client only signs the returned tx via Privy embedded wallet.
// See backend/src/lib/squid.js, backend/src/routes/swap.js, EASYGO_BUILD_PLAN.md §13.2.

import { api, ApiError } from './api';

// ---------------------------------------------------------------------------
// Squid config (client-visible) — kept for screens that surface integrator state
// ---------------------------------------------------------------------------
export const SQUID_CONFIG = {
  integratorId: process.env.EXPO_PUBLIC_SQUID_INTEGRATOR_ID || '',
  apiUrl: process.env.EXPO_PUBLIC_SQUID_API_URL || 'https://apiplus.squidrouter.com',
  // Lazy Liquidity: Squid solver settles on EasyChain even before native DEX liquidity exists
  lazyLiquidity: true,
};

// ---------------------------------------------------------------------------
// Quote — backend computes route via Squid SDK and returns transactionRequest
// ---------------------------------------------------------------------------
export async function getSquidQuote({ fromChain, fromToken, fromAmount, toChain, toToken, toAddress }) {
  try {
    const route = await api.swapQuote({ fromChain, fromToken, fromAmount, toChain, toToken, toAddress });
    return route; // { estimate, transactionRequest, params }
  } catch (e) {
    if (e instanceof ApiError) {
      console.warn('[squid] quote failed', e.status, e.body);
      return null;
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Execute — sign + broadcast the route's transactionRequest, then log for 🍊 reward
//   route:  result of getSquidQuote
//   signer: ethers-compatible signer from Privy embedded wallet
//           (typically: const { wallets } = useWallets(); wallets[0].getEthersProvider().getSigner())
// ---------------------------------------------------------------------------
export async function executeSquidRoute({ route, signer }) {
  if (!route?.transactionRequest) {
    console.warn('[squid] no transactionRequest in route');
    return null;
  }
  if (!signer) {
    console.warn('[squid] signer required (Privy embedded wallet not ready)');
    return null;
  }

  const { target, data, value, gasLimit } = route.transactionRequest;
  const tx = await signer.sendTransaction({
    to: target,
    data,
    value: value ?? 0,
    gasLimit,
  });
  const receipt = await tx.wait();

  // Log to backend → triggers +10 🍊 reward (see backend/src/routes/swap.js)
  try {
    await api.swapLog({
      txHash: tx.hash,
      fromChain: route.params?.fromChain,
      toChain: route.params?.toChain,
      fromToken: route.params?.fromToken,
      toToken: route.params?.toToken,
      fromAmount: route.params?.fromAmount,
      status: receipt?.status === 1 ? 'success' : 'failed',
    });
  } catch (e) {
    console.warn('[squid] swap log failed (reward may not credit)', e);
  }

  return { tx, receipt };
}

// ---------------------------------------------------------------------------
// Phase 2: NEAR Intents takes over for solver-based swaps once liquidity matures
// ---------------------------------------------------------------------------
// See utils/nearIntents.js (Phase 2)
