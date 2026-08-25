import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  SQUID_QUOTE_PREVIEW_DIRECTIONS,
  SQUID_QUOTE_PREVIEW_TOKENS,
  buildSquidQuotePreviewRequest,
  formatSquidBaseUnits,
  parseSquidQuotePreviewAmount,
  presentSquidQuotePreview,
} from '../utils/squidQuotePreview.mjs';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const WALLET = '0x1111111111111111111111111111111111111111';

test('the preview token catalog is the reviewed Base native ETH and USDC pair', () => {
  assert.deepEqual(SQUID_QUOTE_PREVIEW_TOKENS.ETH, {
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    decimals: 18,
    chainId: '8453',
  });
  assert.deepEqual(SQUID_QUOTE_PREVIEW_TOKENS.USDC, {
    symbol: 'USDC',
    name: 'USDC',
    address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    decimals: 6,
    chainId: '8453',
  });
});

test('quote amounts convert to smallest units without floating-point rounding', () => {
  assert.deepEqual(
    parseSquidQuotePreviewAmount('0.001', SQUID_QUOTE_PREVIEW_TOKENS.ETH),
    { ok: true, normalized: '0.001', baseUnits: '1000000000000000' },
  );
  assert.deepEqual(
    parseSquidQuotePreviewAmount('12,345678', SQUID_QUOTE_PREVIEW_TOKENS.USDC),
    { ok: true, normalized: '12.345678', baseUnits: '12345678' },
  );
  assert.equal(
    parseSquidQuotePreviewAmount('0', SQUID_QUOTE_PREVIEW_TOKENS.USDC).code,
    'amount_zero',
  );
  assert.equal(
    parseSquidQuotePreviewAmount('1.0000001', SQUID_QUOTE_PREVIEW_TOKENS.USDC).code,
    'amount_precision',
  );
  assert.equal(
    parseSquidQuotePreviewAmount('1e6', SQUID_QUOTE_PREVIEW_TOKENS.USDC).code,
    'amount_invalid',
  );
});

test('preview requests require the current wallet but send only the curated pair and amount', () => {
  const request = buildSquidQuotePreviewRequest({
    amount: '2.5',
    direction: 'USDC_TO_ETH',
    walletAddress: WALLET.toUpperCase().replace('0X', '0x'),
  });

  assert.equal(request.ok, true);
  assert.deepEqual(request.params, {
    fromToken: SQUID_QUOTE_PREVIEW_TOKENS.USDC.address,
    fromAmount: '2500000',
    toToken: SQUID_QUOTE_PREVIEW_TOKENS.ETH.address,
  });
  assert.deepEqual(Object.keys(request.params).sort(), [
    'fromAmount',
    'fromToken',
    'toToken',
  ]);
});

test('sanitized preview responses render token amounts and only sum USD costs', () => {
  const pair = SQUID_QUOTE_PREVIEW_DIRECTIONS.ETH_TO_USDC;
  const presentation = presentSquidQuotePreview({
    defaultChain: '8453',
    preview: {
      fromToken: { ...pair.fromToken, symbol: 'FAKE', decimals: 999999999 },
      toToken: { ...pair.toToken, symbol: 'FAKE', decimals: 999999999 },
      fromAmount: '1000000000000000',
      toAmount: '2500000',
      toAmountMin: '2475000',
      exchangeRate: '2500.00000000',
      aggregatePriceImpact: '0.12500',
      aggregateSlippage: 1,
      estimatedRouteDuration: 72,
      gasCosts: [{ amount: '100000000000000', amountUsd: '0.01' }],
      feeCosts: [{ amount: '1000', amountUsd: '0.02' }],
      actions: [
        { provider: 'Uniswap' },
        { provider: 'Uniswap' },
        { description: 'Base route' },
      ],
    },
  }, pair);

  assert.deepEqual(presentation, {
    fromLabel: '0.001 ETH',
    toLabel: '2.5 USDC',
    minimumLabel: '2.475 USDC',
    rateLabel: '2500',
    priceImpactLabel: '0.125',
    slippageLabel: '1',
    durationLabel: '2 min',
    feeUsdLabel: '$0.03',
    providersLabel: 'Uniswap · Base route',
    chainLabel: 'Base',
  });
  assert.equal(formatSquidBaseUnits('123456789', 6, 4), '123.4567');
  assert.equal(formatSquidBaseUnits('1', 999999999, 4), null);
});

test('the mobile preview is owner-bound, abortable, and has no signing path', () => {
  const screen = source('../screens/Navigation/SquidQuotePreview.js');
  const squid = source('../utils/squidPreview.js');
  const api = source('../utils/api.js');

  assert.match(screen, /useDeviceAccountOperationLease/);
  assert.match(screen, /useEasyGoWalletRuntime/);
  assert.match(screen, /walletRuntime\.status !== 'ready'/);
  assert.match(screen, /new AbortController\(\)/);
  assert.match(screen, /AppState\.addEventListener/);
  assert.match(screen, /isCurrentLease\(operationLease\)/);
  assert.match(screen, /This preview expires after 20 seconds and cannot be executed/);
  assert.doesNotMatch(screen, /executeSquidRoute|swapLog|sendTransaction|getSigner|getProvider/);

  assert.match(squid, /getSquidQuotePreview\(\{[\s\S]*?lease,[\s\S]*?isCurrentLease,[\s\S]*?signal,/);
  assert.match(squid, /api\.swapQuotePreview\([\s\S]*?expectedAuthUserId: operationLease\.ownerUserId/);
  assert.match(api, /swapQuotePreview:[\s\S]*?boundAuth: true,[\s\S]*?expectedAuthUserId/);
  assert.doesNotMatch(api, /swapQuote:\s*\(|swapLog:\s*\(/);

  const navigation = source('../navigation/AppNavigator.js');
  const education = source('../screens/Navigation/Trophies/TrophieCoineasy.js');
  const rewards = source('../screens/Navigation/Oranges/OrangeReward.js');
  assert.match(navigation, /name="SquidQuotePreview"/);
  assert.match(education, /navigation\.navigate\('SquidQuotePreview'\)/);
  assert.match(education, /Preview only—no transaction and no Orange reward/);
  assert.doesNotMatch(rewards, /Squid|quote preview|Invite Friends|AD Rewards/);
});
