import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EASYGO_BASE_CHAIN_ID,
  EASYGO_BASE_CHAIN_HEX,
  attestBaseWalletRuntime,
  createBaseScanAddressUrl,
  normalizeEvmAddress,
  parseEvmChainId,
} from '../utils/baseWalletRuntime.mjs';

const ADDRESS = '0x1234567890aBCDef1234567890abCDef12345678';

test('Base chain constants and EIP-1193 chain responses stay aligned', () => {
  assert.equal(EASYGO_BASE_CHAIN_ID, 8453);
  assert.equal(EASYGO_BASE_CHAIN_HEX, '0x2105');
  assert.equal(parseEvmChainId('0x2105'), 8453);
  assert.equal(parseEvmChainId('8453'), 8453);
  assert.equal(parseEvmChainId('not-a-chain'), null);
});

test('runtime attestation requires Base and the authenticated embedded wallet account', () => {
  assert.deepEqual(attestBaseWalletRuntime({
    chainId: '0x2105',
    accounts: [ADDRESS.toLowerCase()],
    walletAddress: ADDRESS,
    expectedAddress: ADDRESS.toLowerCase(),
  }), { status: 'ready', chainId: 8453 });

  assert.deepEqual(attestBaseWalletRuntime({
    chainId: '0x1',
    accounts: [ADDRESS],
    walletAddress: ADDRESS,
    expectedAddress: ADDRESS,
  }), { status: 'wrong-chain', chainId: 1 });

  assert.deepEqual(attestBaseWalletRuntime({
    chainId: '0x2105',
    accounts: ['0x0000000000000000000000000000000000000000'],
    walletAddress: ADDRESS,
    expectedAddress: ADDRESS,
  }), { status: 'account-mismatch', chainId: 8453 });

  assert.deepEqual(attestBaseWalletRuntime({
    chainId: '0x2105',
    accounts: [ADDRESS],
    walletAddress: ADDRESS,
    expectedAddress: null,
  }), { status: 'ready', chainId: 8453 });

  assert.deepEqual(attestBaseWalletRuntime({
    chainId: '0x2105',
    accounts: [ADDRESS],
    walletAddress: ADDRESS,
    expectedAddress: 'not-an-address',
  }), { status: 'error', chainId: 8453 });

  assert.deepEqual(attestBaseWalletRuntime({
    chainId: '0x2105',
    accounts: [ADDRESS],
    walletAddress: ADDRESS,
    expectedAddress: '0x0000000000000000000000000000000000000000',
  }), { status: 'account-mismatch', chainId: 8453 });
});

test('BaseScan links accept only normalized EVM addresses', () => {
  assert.equal(normalizeEvmAddress(ADDRESS), ADDRESS.toLowerCase());
  assert.equal(
    createBaseScanAddressUrl(ADDRESS),
    `https://basescan.org/address/${ADDRESS.toLowerCase()}`,
  );
  assert.equal(createBaseScanAddressUrl('0x1234'), null);
});
