import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BASE_USDC_ADDRESS,
  getQuotePreview,
  PHASE_1_CHAIN_ID,
  QUOTE_PREVIEW_SLIPPAGE,
  SQUID_NATIVE_ETH_ADDRESS,
} from '../src/lib/squid.js';
import { createQuotePreviewHandler, swapRouter } from '../src/routes/swap.js';

const WALLET_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const FROM_AMOUNT = '1250000';

function token(address, symbol, decimals) {
  return {
    chainId: PHASE_1_CHAIN_ID,
    address,
    name: symbol === 'USDC' ? 'USD Coin' : 'Ether',
    symbol,
    decimals,
    logoURI: 'https://example.invalid/token.png',
    usdPrice: 1,
    originalAddress: 'must-not-leak',
  };
}

function squidResponse() {
  const usdc = token(BASE_USDC_ADDRESS, 'USDC', 6);
  const eth = token(SQUID_NATIVE_ETH_ADDRESS, 'ETH', 18);
  return {
    requestId: 'upstream-request-id',
    route: {
      quoteId: 'quote-secret',
      params: {
        fromAddress: WALLET_ADDRESS,
        fromChain: PHASE_1_CHAIN_ID,
        fromToken: BASE_USDC_ADDRESS,
        fromAmount: FROM_AMOUNT,
        toChain: PHASE_1_CHAIN_ID,
        toToken: SQUID_NATIVE_ETH_ADDRESS,
        toAddress: WALLET_ADDRESS,
        slippage: QUOTE_PREVIEW_SLIPPAGE,
        quoteOnly: true,
      },
      transactionRequest: {
        target: '0x0000000000000000000000000000000000000001',
        data: '0xdeadbeef',
        value: '0',
      },
      estimate: {
        fromToken: usdc,
        toToken: eth,
        fromAmount: FROM_AMOUNT,
        toAmount: '500000000000000',
        toAmountMin: '495000000000000',
        exchangeRate: '0.0004',
        aggregatePriceImpact: '0.02',
        estimatedRouteDuration: 12,
        aggregateSlippage: 1,
        gasCosts: [{
          type: 'executeCall',
          gasLimit: '21000',
          amount: '10000000000000',
          amountUsd: '0.03',
          token: eth,
          transactionRequest: { data: '0xgas-calldata' },
        }],
        feeCosts: [{
          name: 'Integrator fee',
          description: 'Integrator fee',
          percentage: '0.1',
          gasLimit: '0',
          gasMultiplier: 1,
          amount: '1250',
          amountUsd: '0.00125',
          token: usdc,
          receiver: '0x0000000000000000000000000000000000000002',
          data: { calldata: '0xfee-calldata' },
        }],
        actions: [{
          type: 'swap',
          fromChain: PHASE_1_CHAIN_ID,
          toChain: PHASE_1_CHAIN_ID,
          fromToken: usdc,
          toToken: eth,
          fromAmount: FROM_AMOUNT,
          toAmount: '500000000000000',
          toAmountMin: '495000000000000',
          exchangeRate: '0.0004',
          priceImpact: '0.02',
          provider: 'Squid',
          description: 'Swap on Base',
          estimatedDuration: 12,
          data: {
            name: 'Base swap',
            provider: 'Squid',
            type: 'swap',
            dex: 'uniswap-v3',
            liquidityProvider: 'Uniswap',
            exchangeProvider: 'Uniswap',
            isStable: false,
            estimatedFillDuration: 10,
            target: '0x0000000000000000000000000000000000000003',
            calls: [{ callData: '0xaction-calldata' }],
            custom: { secret: 'must-not-leak' },
          },
        }],
      },
    },
  };
}

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('Squid preview requests quoteOnly on Base and strips executable transaction data', async () => {
  let request;
  const preview = await getQuotePreview({
    walletAddress: WALLET_ADDRESS,
    fromToken: BASE_USDC_ADDRESS.toUpperCase(),
    toToken: SQUID_NATIVE_ETH_ADDRESS,
    fromAmount: FROM_AMOUNT,
  }, {
    squidClient: {
      async getRoute(value) {
        request = value;
        return squidResponse();
      },
    },
  });

  assert.deepEqual(request, {
    fromAddress: WALLET_ADDRESS,
    fromChain: PHASE_1_CHAIN_ID,
    fromToken: BASE_USDC_ADDRESS,
    fromAmount: FROM_AMOUNT,
    toChain: PHASE_1_CHAIN_ID,
    toToken: SQUID_NATIVE_ETH_ADDRESS,
    toAddress: WALLET_ADDRESS,
    slippage: QUOTE_PREVIEW_SLIPPAGE,
    quoteOnly: true,
  });
  assert.deepEqual(Object.keys(preview), [
    'fromToken',
    'toToken',
    'fromAmount',
    'toAmount',
    'toAmountMin',
    'exchangeRate',
    'aggregatePriceImpact',
    'estimatedRouteDuration',
    'aggregateSlippage',
    'gasCosts',
    'feeCosts',
    'actions',
  ]);
  assert.deepEqual(preview.fromToken, {
    chainId: PHASE_1_CHAIN_ID,
    address: BASE_USDC_ADDRESS,
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  });
  assert.deepEqual(preview.actions[0].data, {
    name: 'Base swap',
    provider: 'Squid',
    type: 'swap',
    dex: 'uniswap-v3',
    liquidityProvider: 'Uniswap',
    exchangeProvider: 'Uniswap',
    isStable: false,
    estimatedFillDuration: 10,
  });

  const serialized = JSON.stringify(preview);
  for (const secret of [
    'transactionRequest',
    'deadbeef',
    'target',
    'calls',
    'callData',
    'calldata',
    'quote-secret',
    'receiver',
    'must-not-leak',
  ]) {
    assert.equal(serialized.includes(secret), false, `${secret} must not cross the preview boundary`);
  }
});

test('Squid preview rejects an envelope or route that is not bound to the request', async () => {
  await assert.rejects(
    () => getQuotePreview({
      walletAddress: WALLET_ADDRESS,
      fromToken: BASE_USDC_ADDRESS,
      toToken: SQUID_NATIVE_ETH_ADDRESS,
      fromAmount: FROM_AMOUNT,
    }, { squidClient: { getRoute: async () => ({ estimate: {} }) } }),
    /no route estimate/u,
  );

  const mismatched = squidResponse();
  mismatched.route.params.toAddress = '0x0000000000000000000000000000000000000004';
  await assert.rejects(
    () => getQuotePreview({
      walletAddress: WALLET_ADDRESS,
      fromToken: BASE_USDC_ADDRESS,
      toToken: SQUID_NATIVE_ETH_ADDRESS,
      fromAmount: FROM_AMOUNT,
    }, { squidClient: { getRoute: async () => mismatched } }),
    /does not match the bound preview request/u,
  );

  const mismatchedEstimate = squidResponse();
  mismatchedEstimate.route.estimate.fromAmount = '9999999';
  await assert.rejects(
    () => getQuotePreview({
      walletAddress: WALLET_ADDRESS,
      fromToken: BASE_USDC_ADDRESS,
      toToken: SQUID_NATIVE_ETH_ADDRESS,
      fromAmount: FROM_AMOUNT,
    }, { squidClient: { getRoute: async () => mismatchedEstimate } }),
    /does not match the bound preview request/u,
  );
});

test('quote-preview route is authenticated and leaves the execution and log surfaces intact', () => {
  const routes = swapRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).map((method) => method.toUpperCase()),
      middlewareCount: layer.route.stack.length,
    }));

  assert.deepEqual(routes, [
    { path: '/quote-preview', methods: ['POST'], middlewareCount: 2 },
    { path: '/quote', methods: ['POST'], middlewareCount: 2 },
    { path: '/log', methods: ['POST'], middlewareCount: 2 },
  ]);
});

test('quote-preview derives both addresses from the authenticated stored wallet', async () => {
  let dbQuery;
  let previewInput;
  const response = responseDouble();
  const expectedPreview = { toAmount: '500000000000000' };
  const handler = createQuotePreviewHandler({
    db: {
      user: {
        findUnique: async (query) => {
          dbQuery = query;
          return { walletAddress: WALLET_ADDRESS };
        },
      },
    },
    fetchPreview: async (input) => {
      previewInput = input;
      return expectedPreview;
    },
  });

  await handler({
    body: {
      fromToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      toToken: SQUID_NATIVE_ETH_ADDRESS,
      fromAmount: FROM_AMOUNT,
    },
    user: { privyDid: 'did:privy:current' },
  }, response);

  assert.deepEqual(dbQuery, {
    where: { privyDid: 'did:privy:current' },
    select: { walletAddress: true },
  });
  assert.deepEqual(previewInput, {
    walletAddress: WALLET_ADDRESS,
    fromToken: BASE_USDC_ADDRESS,
    toToken: SQUID_NATIVE_ETH_ADDRESS,
    fromAmount: FROM_AMOUNT,
  });
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(response.body, { preview: expectedPreview, defaultChain: PHASE_1_CHAIN_ID });
  assert.equal(JSON.stringify(response.body).includes(WALLET_ADDRESS), false);
});

test('invalid preview bodies are rejected before database or Squid access', async (t) => {
  const invalidBodies = [
    { fromToken: BASE_USDC_ADDRESS, toToken: SQUID_NATIVE_ETH_ADDRESS, fromAmount: '0' },
    { fromToken: BASE_USDC_ADDRESS, toToken: SQUID_NATIVE_ETH_ADDRESS, fromAmount: '1.5' },
    { fromToken: BASE_USDC_ADDRESS, toToken: SQUID_NATIVE_ETH_ADDRESS, fromAmount: 'abc' },
    { fromToken: BASE_USDC_ADDRESS, toToken: BASE_USDC_ADDRESS, fromAmount: '1' },
    { fromToken: '0x0000000000000000000000000000000000000001', toToken: SQUID_NATIVE_ETH_ADDRESS, fromAmount: '1' },
    { fromToken: BASE_USDC_ADDRESS, toToken: SQUID_NATIVE_ETH_ADDRESS, fromAmount: '9'.repeat(79) },
    {
      fromToken: BASE_USDC_ADDRESS,
      toToken: SQUID_NATIVE_ETH_ADDRESS,
      fromAmount: '1',
      fromAddress: WALLET_ADDRESS,
    },
    {
      fromToken: BASE_USDC_ADDRESS,
      toToken: SQUID_NATIVE_ETH_ADDRESS,
      fromAmount: '1',
      slippage: 50,
    },
  ];

  for (const body of invalidBodies) {
    await t.test(JSON.stringify(body), async () => {
      let reads = 0;
      let quotes = 0;
      const response = responseDouble();
      const handler = createQuotePreviewHandler({
        db: { user: { findUnique: async () => { reads += 1; } } },
        fetchPreview: async () => { quotes += 1; },
      });
      await handler({ body, user: { privyDid: 'did:privy:current' } }, response);
      assert.equal(response.statusCode, 400);
      assert.equal(response.body.error, 'bad_input');
      assert.equal(reads, 0);
      assert.equal(quotes, 0);
    });
  }
});

test('missing or invalid stored wallets cannot request a preview', async (t) => {
  for (const user of [null, { walletAddress: null }, { walletAddress: 'not-an-address' }]) {
    await t.test(JSON.stringify(user), async () => {
      let quoteCalls = 0;
      const response = responseDouble();
      const handler = createQuotePreviewHandler({
        db: { user: { findUnique: async () => user } },
        fetchPreview: async () => { quoteCalls += 1; },
      });
      await handler({
        body: {
          fromToken: BASE_USDC_ADDRESS,
          toToken: SQUID_NATIVE_ETH_ADDRESS,
          fromAmount: '1',
        },
        user: { privyDid: 'did:privy:current' },
      }, response);

      assert.equal(response.statusCode, user ? 409 : 404);
      assert.equal(response.body.error, user ? 'wallet_not_ready' : 'user_not_found');
      assert.equal(quoteCalls, 0);
    });
  }
});

test('upstream preview failures return a generic error without leaking details', async () => {
  const response = responseDouble();
  const logs = [];
  const handler = createQuotePreviewHandler({
    db: { user: { findUnique: async () => ({ walletAddress: WALLET_ADDRESS }) } },
    fetchPreview: async () => { throw new Error('upstream secret response body'); },
  });
  await handler({
    body: {
      fromToken: BASE_USDC_ADDRESS,
      toToken: SQUID_NATIVE_ETH_ADDRESS,
      fromAmount: '1',
    },
    user: { privyDid: 'did:privy:current' },
    log: { error: (...args) => logs.push(args) },
  }, response);

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.body, { error: 'squid_failed' });
  assert.equal(JSON.stringify(response.body).includes('secret'), false);
  assert.equal(logs.length, 1);
  assert.equal(JSON.stringify(logs).includes('secret'), false);
});
