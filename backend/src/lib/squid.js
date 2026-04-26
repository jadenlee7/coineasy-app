/**
 * Squid SDK server-side wrapper.
 *
 * Phase 1 (Path C):
 *   - Source/destination chain default = Base (chainId 8453).
 *   - We expose two thin functions: getQuote() + buildExecuteTx().
 *   - The actual signing happens client-side (Privy embedded wallet);
 *     this server only fetches routes + integrator-attributes the call.
 *
 * EasyChain note:
 *   - When PHASE.EASYCHAIN_ENABLED flips true (Phase 2), the chain
 *     constants below are the only thing that must change here.
 */

import { Squid } from '@squidrouter/sdk';

const INTEGRATOR_ID = process.env.SQUID_INTEGRATOR_ID;
const BASE_URL = process.env.SQUID_API_URL || 'https://apiplus.squidrouter.com';

export const PHASE_1_CHAIN_ID = '8453'; // Base mainnet

let _squid = null;
let _initPromise = null;

async function getSquid() {
  if (_squid) return _squid;
  if (!_initPromise) {
    _initPromise = (async () => {
      if (!INTEGRATOR_ID) throw new Error('SQUID_INTEGRATOR_ID not set');
      const squid = new Squid({ baseUrl: BASE_URL, integratorId: INTEGRATOR_ID });
      await squid.init();
      _squid = squid;
      return squid;
    })();
  }
  return _initPromise;
}

/**
 * @param {object} params
 * @param {string} params.fromAddress      - user's Base address
 * @param {string} params.fromChain        - default Base
 * @param {string} params.fromToken        - ERC20 address or native sentinel
 * @param {string} params.fromAmount       - in wei / smallest unit (string)
 * @param {string} params.toChain          - default Base
 * @param {string} params.toToken
 * @param {string} [params.toAddress]      - default = fromAddress
 * @param {number} [params.slippage]       - default 1 (= 1%)
 */
export async function getQuote(params) {
  const squid = await getSquid();
  const route = await squid.getRoute({
    fromAddress: params.fromAddress,
    fromChain: params.fromChain || PHASE_1_CHAIN_ID,
    fromToken: params.fromToken,
    fromAmount: params.fromAmount,
    toChain: params.toChain || PHASE_1_CHAIN_ID,
    toToken: params.toToken,
    toAddress: params.toAddress || params.fromAddress,
    slippage: params.slippage ?? 1,
    enableForecall: true,
    quoteOnly: false,
  });
  return route;
}

/**
 * Returns the unsigned tx payload for the client to sign with the
 * Privy embedded wallet. We do NOT execute on-chain server-side.
 */
export function buildExecuteTx(route) {
  const tx = route?.transactionRequest;
  if (!tx) throw new Error('route has no transactionRequest');
  return {
    to: tx.target || tx.to,
    data: tx.data,
    value: tx.value || '0',
    gasLimit: tx.gasLimit,
    gasPrice: tx.gasPrice,
  };
}
