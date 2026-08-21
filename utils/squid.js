// utils/squid.js
// Squid Router integration (cross-chain bridge for EasyGo Phase 1).
// Phase 1: client delegates quote + log to backend (/swap/quote, /swap/log).
// Backend uses @0xsquid/sdk server-side; client only signs the returned tx via Privy embedded wallet.
// See backend/src/lib/squid.js, backend/src/routes/swap.js, EASYGO_BUILD_PLAN.md §13.2.

import { api, ApiError } from './api';
import {
  SquidRouteLeaseError,
  createSquidRouteLeaseRegistry,
} from './squidRouteLease.mjs';

// ---------------------------------------------------------------------------
// Squid config (client-visible) — kept for screens that surface integrator state
// ---------------------------------------------------------------------------
export const SQUID_CONFIG = {
  integratorId: process.env.EXPO_PUBLIC_SQUID_INTEGRATOR_ID || '',
  apiUrl: process.env.EXPO_PUBLIC_SQUID_API_URL || 'https://apiplus.squidrouter.com',
  // Lazy Liquidity: Squid solver settles on EasyChain even before native DEX liquidity exists
  lazyLiquidity: true,
};

const squidRouteLeases = createSquidRouteLeaseRegistry();

// ---------------------------------------------------------------------------
// Quote — backend computes the route and returns { route, tx, defaultChain }.
// ---------------------------------------------------------------------------
export async function getSquidQuote({
  fromAddress,
  fromChain,
  fromToken,
  fromAmount,
  toChain,
  toToken,
  toAddress,
  slippage,
  lease,
  isCurrentLease,
}) {
  const operationLease = squidRouteLeases.requireCurrent(lease, isCurrentLease);
  try {
    const quote = await api.swapQuote(
      {
        fromAddress,
        fromChain,
        fromToken,
        fromAmount,
        toChain,
        toToken,
        toAddress,
        slippage,
      },
      { expectedAuthUserId: operationLease.ownerUserId },
    );
    squidRouteLeases.requireCurrent(operationLease, isCurrentLease);
    if (!quote?.route || !quote?.tx) return null;
    return squidRouteLeases.bind(quote, operationLease, isCurrentLease);
  } catch (e) {
    squidRouteLeases.requireCurrent(operationLease, isCurrentLease);
    if (e instanceof ApiError) {
      console.warn('[squid] quote failed', e.status);
      return null;
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Read-only quote preview — sanitized backend response, no executable tx.
// ---------------------------------------------------------------------------
export async function getSquidQuotePreview({
  fromToken,
  fromAmount,
  toToken,
  lease,
  isCurrentLease,
  signal,
}) {
  const operationLease = squidRouteLeases.requireCurrent(lease, isCurrentLease);
  try {
    const result = await api.swapQuotePreview(
      {
        fromToken,
        fromAmount,
        toToken,
      },
      {
        signal,
        expectedAuthUserId: operationLease.ownerUserId,
      },
    );
    squidRouteLeases.requireCurrent(operationLease, isCurrentLease);
    return result?.preview ? result : null;
  } catch (error) {
    squidRouteLeases.requireCurrent(operationLease, isCurrentLease);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Execute — sign + broadcast the backend's unsigned tx, then log for 🍊 reward
//   quote:  exact in-memory result of getSquidQuote (clones are rejected)
//   signer: ethers-compatible signer from Privy embedded wallet
//           (typically: const { wallets } = useWallets(); wallets[0].getEthersProvider().getSigner())
// ---------------------------------------------------------------------------
export async function executeSquidRoute({ quote, signer, lease, isCurrentLease }) {
  const operationLease = squidRouteLeases.requireBound(
    quote,
    lease,
    isCurrentLease,
  );
  if (!quote?.tx) {
    console.warn('[squid] no unsigned transaction in quote');
    return null;
  }
  if (!signer) {
    console.warn('[squid] signer required (Privy embedded wallet not ready)');
    return null;
  }

  const { to, data, value, gasLimit, gasPrice } = quote.tx;
  // This is the last synchronous fence before the irreversible wallet prompt.
  squidRouteLeases.requireBound(quote, operationLease, isCurrentLease);
  const tx = await signer.sendTransaction({
    to,
    data,
    value: value ?? 0,
    gasLimit,
    gasPrice,
  });
  const receipt = await tx.wait();
  squidRouteLeases.requireBound(quote, operationLease, isCurrentLease);

  // Log to backend → triggers +10 🍊 reward (see backend/src/routes/swap.js)
  try {
    await api.swapLog(
      {
        txHash: tx.hash,
        fromToken: quote.route?.params?.fromToken,
        toToken: quote.route?.params?.toToken,
        fromAmount: quote.route?.params?.fromAmount,
        toAmount: quote.route?.estimate?.toAmount,
        chainId: quote.route?.params?.fromChain || quote.defaultChain,
      },
      { expectedAuthUserId: operationLease.ownerUserId },
    );
  } catch (e) {
    // If the account changed, do not convert the fail-closed owner error into a
    // successful completion that a replacement account could render.
    squidRouteLeases.requireBound(quote, operationLease, isCurrentLease);
    if (e instanceof SquidRouteLeaseError) throw e;
    console.warn('[squid] swap log failed (reward may not credit)');
  }

  squidRouteLeases.requireBound(quote, operationLease, isCurrentLease);
  return { tx, receipt };
}

// ---------------------------------------------------------------------------
// Phase 2: NEAR Intents takes over for solver-based swaps once liquidity matures
// ---------------------------------------------------------------------------
// See utils/nearIntents.js (Phase 2)
