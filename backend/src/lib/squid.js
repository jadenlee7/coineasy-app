/**
 * Squid SDK server-side wrapper.
 *
 * Phase 1 (Path C):
 *   - Source/destination chain default = Base (chainId 8453).
 *   - We expose the legacy executable quote helpers plus a separate,
 *     display-only getQuotePreview() boundary.
 *   - The actual signing happens client-side (Privy embedded wallet);
 *     this server only fetches routes + integrator-attributes the call.
 *
 * EasyChain note:
 *   - When PHASE.EASYCHAIN_ENABLED flips true (Phase 2), the chain
 *     constants below are the only thing that must change here.
 */

import { Squid } from '@0xsquid/sdk';

const INTEGRATOR_ID = process.env.SQUID_INTEGRATOR_ID;
const BASE_URL = process.env.SQUID_API_URL || 'https://apiplus.squidrouter.com';

export const PHASE_1_CHAIN_ID = '8453'; // Base mainnet
export const SQUID_NATIVE_ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const BASE_USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
export const QUOTE_PREVIEW_SLIPPAGE = 1;
export const QUOTE_PREVIEW_TOKEN_ADDRESSES = Object.freeze([
  SQUID_NATIVE_ETH_ADDRESS,
  BASE_USDC_ADDRESS,
]);

const QUOTE_PREVIEW_TOKEN_SET = new Set(QUOTE_PREVIEW_TOKEN_ADDRESSES);
const QUOTE_PREVIEW_TOKEN_METADATA = Object.freeze({
  [SQUID_NATIVE_ETH_ADDRESS]: Object.freeze({
    chainId: PHASE_1_CHAIN_ID,
    address: SQUID_NATIVE_ETH_ADDRESS,
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  }),
  [BASE_USDC_ADDRESS]: Object.freeze({
    chainId: PHASE_1_CHAIN_ID,
    address: BASE_USDC_ADDRESS,
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  }),
});
const MAX_PREVIEW_LIST_LENGTH = 16;
const MAX_PREVIEW_STRING_LENGTH = 512;

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

function displayScalar(value) {
  if (typeof value === 'string') return value.slice(0, MAX_PREVIEW_STRING_LENGTH);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  return null;
}

function displayToken(token) {
  if (!token || typeof token !== 'object') return null;
  const address = normalizedTokenAddress(token.address);
  const canonical = QUOTE_PREVIEW_TOKEN_METADATA[address];
  return canonical ? { ...canonical } : null;
}

function displayGasCost(cost) {
  return {
    type: displayScalar(cost?.type),
    gasLimit: displayScalar(cost?.gasLimit),
    amount: displayScalar(cost?.amount),
    amountUsd: displayScalar(cost?.amountUsd),
    token: displayToken(cost?.token),
  };
}

function displayFeeCost(cost) {
  return {
    name: displayScalar(cost?.name),
    description: displayScalar(cost?.description),
    percentage: displayScalar(cost?.percentage),
    gasLimit: displayScalar(cost?.gasLimit),
    gasMultiplier: displayScalar(cost?.gasMultiplier),
    amount: displayScalar(cost?.amount),
    amountUsd: displayScalar(cost?.amountUsd),
    token: displayToken(cost?.token),
  };
}

function displayActionData(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    name: displayScalar(data.name),
    provider: displayScalar(data.provider),
    type: displayScalar(data.type),
    dex: displayScalar(data.dex),
    liquidityProvider: displayScalar(data.liquidityProvider),
    exchangeProvider: displayScalar(data.exchangeProvider),
    isStable: displayScalar(data.isStable),
    estimatedFillDuration: displayScalar(data.estimatedFillDuration),
  };
}

function displayAction(action) {
  return {
    type: displayScalar(action?.type),
    fromChain: displayScalar(action?.fromChain),
    toChain: displayScalar(action?.toChain),
    fromToken: displayToken(action?.fromToken),
    toToken: displayToken(action?.toToken),
    fromAmount: displayScalar(action?.fromAmount),
    toAmount: displayScalar(action?.toAmount),
    toAmountMin: displayScalar(action?.toAmountMin),
    exchangeRate: displayScalar(action?.exchangeRate),
    priceImpact: displayScalar(action?.priceImpact),
    provider: displayScalar(action?.provider),
    description: displayScalar(action?.description),
    estimatedDuration: displayScalar(action?.estimatedDuration),
    data: displayActionData(action?.data),
  };
}

function displayList(value, mapper) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_PREVIEW_LIST_LENGTH).map(mapper);
}

/**
 * The installed Squid SDK returns `{ route: { estimate, ... } }`. Keep the
 * normalization explicit so callers cannot accidentally treat the response
 * envelope as an executable route.
 */
export function normalizeSquidRouteResponse(response) {
  const route = response?.route;
  if (!route || typeof route !== 'object' || !route.estimate || typeof route.estimate !== 'object') {
    throw new Error('Squid response has no route estimate');
  }
  return route;
}

/**
 * Convert a Squid route into a display-only value. This is an allowlist, not a
 * generic object clone: transactionRequest, calldata, calls, targets, quoteId,
 * params, receivers and arbitrary provider data never cross this boundary.
 */
export function sanitizeQuotePreview(response) {
  const { estimate } = normalizeSquidRouteResponse(response);
  return {
    fromToken: displayToken(estimate.fromToken),
    toToken: displayToken(estimate.toToken),
    fromAmount: displayScalar(estimate.fromAmount),
    toAmount: displayScalar(estimate.toAmount),
    toAmountMin: displayScalar(estimate.toAmountMin),
    exchangeRate: displayScalar(estimate.exchangeRate),
    aggregatePriceImpact: displayScalar(estimate.aggregatePriceImpact),
    estimatedRouteDuration: displayScalar(estimate.estimatedRouteDuration),
    aggregateSlippage: displayScalar(estimate.aggregateSlippage),
    gasCosts: displayList(estimate.gasCosts, displayGasCost),
    feeCosts: displayList(estimate.feeCosts, displayFeeCost),
    actions: displayList(estimate.actions, displayAction),
  };
}

function normalizedTokenAddress(value) {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function requireBoundPreviewRoute(route, params) {
  const routeParams = route.params;
  const estimate = route.estimate;
  const walletAddress = normalizedTokenAddress(params.walletAddress);

  const isExpectedRoute = routeParams
    && String(routeParams.fromChain) === PHASE_1_CHAIN_ID
    && String(routeParams.toChain) === PHASE_1_CHAIN_ID
    && normalizedTokenAddress(routeParams.fromToken) === params.fromToken
    && normalizedTokenAddress(routeParams.toToken) === params.toToken
    && normalizedTokenAddress(routeParams.fromAddress) === walletAddress
    && normalizedTokenAddress(routeParams.toAddress) === walletAddress
    && routeParams.fromAmount === params.fromAmount
    && routeParams.quoteOnly === true
    && Number(routeParams.slippage) === QUOTE_PREVIEW_SLIPPAGE
    && estimate?.fromAmount === params.fromAmount
    && normalizedTokenAddress(estimate?.fromToken?.address) === params.fromToken
    && normalizedTokenAddress(estimate?.toToken?.address) === params.toToken
    && String(estimate?.fromToken?.chainId) === PHASE_1_CHAIN_ID
    && String(estimate?.toToken?.chainId) === PHASE_1_CHAIN_ID;

  if (!isExpectedRoute) throw new Error('Squid response does not match the bound preview request');
}

/**
 * Fetches a Base-only, account-bound estimate with `quoteOnly:true`. Squid may
 * still include transaction material in its response, so this boundary always
 * discards it and returns only the sanitized preview projection.
 */
export async function getQuotePreview(params, { squidClient } = {}) {
  const fromToken = normalizedTokenAddress(params?.fromToken);
  const toToken = normalizedTokenAddress(params?.toToken);
  if (!QUOTE_PREVIEW_TOKEN_SET.has(fromToken)
    || !QUOTE_PREVIEW_TOKEN_SET.has(toToken)
    || fromToken === toToken) {
    throw new Error('Unsupported quote preview token pair');
  }

  const squid = squidClient || await getSquid();
  const request = {
    fromAddress: params.walletAddress,
    fromChain: PHASE_1_CHAIN_ID,
    fromToken,
    fromAmount: params.fromAmount,
    toChain: PHASE_1_CHAIN_ID,
    toToken,
    toAddress: params.walletAddress,
    slippage: QUOTE_PREVIEW_SLIPPAGE,
    quoteOnly: true,
  };
  const response = await squid.getRoute(request);
  const route = normalizeSquidRouteResponse(response);
  requireBoundPreviewRoute(route, { ...request, walletAddress: params.walletAddress });
  return sanitizeQuotePreview(response);
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
