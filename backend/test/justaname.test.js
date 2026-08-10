import assert from 'node:assert/strict';
import test from 'node:test';
import { privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage } from 'viem/siwe';
import {
  addJustaNameSubname,
  BASE_COIN_TYPE,
  fullSubname,
  getJustaNameSubname,
  getJustaNameConfig,
  hashJustaNameChallenge,
  isJustaNameAvailable,
  JUSTANAME_CHALLENGE_TTL_MS,
  normalizeSubnameLabel,
  parseAndValidateJustaNameChallenge,
  requestJustaNameChallenge,
  subnameResolvesToAddress,
} from '../src/lib/justaname.js';

const account = privateKeyToAccount(
  '0x5de4111afa1c4b3daadb3b1efb3a062faa17b3680332b7e29aa0d8c42f66ea4a',
);
const config = {
  apiKey: 'test-api-key',
  ensDomain: 'coineasy.eth',
  domain: 'api.easygo.test',
  origin: 'https://api.easygo.test/identity',
  chainId: 1,
};
const issuedAt = new Date('2026-07-21T12:00:00.000Z');
const expirationTime = new Date(issuedAt.getTime() + JUSTANAME_CHALLENGE_TTL_MS);

function challenge(overrides = {}) {
  return createSiweMessage({
    address: account.address,
    chainId: config.chainId,
    domain: config.domain,
    uri: config.origin,
    version: '1',
    nonce: 'JustaNameNonce123',
    statement: 'Issue an EasyGo ENS subname.',
    issuedAt,
    expirationTime,
    ...overrides,
  });
}

test('JustaName config is explicit and production is Ethereum-mainnet only', () => {
  assert.deepEqual(getJustaNameConfig({
    JUSTANAME_API_KEY: ' test-api-key ',
    JUSTANAME_ENS_DOMAIN: 'CoinEasy.ETH',
    JUSTANAME_DOMAIN: 'api.easygo.test',
    JUSTANAME_ORIGIN: 'https://api.easygo.test/identity',
    JUSTANAME_CHAIN_ID: '1',
    NODE_ENV: 'production',
  }), config);
  assert.throws(() => getJustaNameConfig({}), /are required/);
  assert.throws(() => getJustaNameConfig({
    JUSTANAME_API_KEY: 'key',
    JUSTANAME_ENS_DOMAIN: 'coineasy.eth',
    JUSTANAME_DOMAIN: 'api.easygo.test',
    JUSTANAME_ORIGIN: 'https://api.easygo.test/identity',
    JUSTANAME_CHAIN_ID: '11155111',
    NODE_ENV: 'production',
  }), /mainnet/);
});

test('EasyGo handles map to a conservative ENS label policy', () => {
  assert.equal(normalizeSubnameLabel('Jaden7'), 'jaden7');
  assert.equal(fullSubname('jaden7', config), 'jaden7.coineasy.eth');
  assert.throws(
    () => normalizeSubnameLabel('name_with_underscore'),
    (error) => error.code === 'username_not_ens_compatible',
  );
  assert.throws(
    () => normalizeSubnameLabel('support'),
    (error) => error.code === 'reserved_subname',
  );
});

test('stored JustaName challenges are exact, short-lived, and address-bound', () => {
  const message = challenge();
  const parsed = parseAndValidateJustaNameChallenge({
    message,
    expectedAddress: account.address,
    expectedHash: hashJustaNameChallenge(message),
    expectedExpiresAt: expirationTime,
    config,
    now: new Date('2026-07-21T12:01:00.000Z'),
  });
  assert.equal(parsed.chainId, 1);
  assert.equal(parsed.address, account.address);

  assert.throws(() => parseAndValidateJustaNameChallenge({
    message,
    expectedAddress: '0x0000000000000000000000000000000000000001',
    expectedHash: hashJustaNameChallenge(message),
    expectedExpiresAt: expirationTime,
    config,
    now: new Date('2026-07-21T12:01:00.000Z'),
  }), (error) => error.code === 'invalid_justaname_address');
  assert.throws(() => parseAndValidateJustaNameChallenge({
    message,
    expectedAddress: account.address,
    expectedHash: hashJustaNameChallenge(`${message}tampered`),
    expectedExpiresAt: expirationTime,
    config,
    now: new Date('2026-07-21T12:01:00.000Z'),
  }), (error) => error.code === 'invalid_justaname_challenge');
  assert.throws(() => parseAndValidateJustaNameChallenge({
    message,
    expectedAddress: account.address,
    expectedHash: hashJustaNameChallenge(message),
    expectedExpiresAt: expirationTime,
    config,
    now: expirationTime,
  }), (error) => error.code === 'justaname_challenge_expired');
});

test('SDK challenge and availability calls use the configured ENS network', async () => {
  const calls = [];
  const message = challenge();
  const client = {
    siwe: {
      requestChallenge: async (params) => {
        calls.push(['challenge', params]);
        return { challenge: message };
      },
    },
    subnames: {
      isSubnameAvailable: async (params) => {
        calls.push(['available', params]);
        return { isAvailable: true };
      },
    },
  };

  assert.equal(await requestJustaNameChallenge({ client, address: account.address, config }), message);
  assert.equal(await isJustaNameAvailable({
    client,
    subname: 'jaden7.coineasy.eth',
    config,
  }), true);
  assert.equal(calls[0][1].chainId, 1);
  assert.equal(calls[0][1].ttl, JUSTANAME_CHALLENGE_TTL_MS);
  assert.deepEqual(calls[1][1], { subname: 'jaden7.coineasy.eth', chainId: 1 });
});

test('subname issuance stores Ethereum and Base ENSIP-19 address records', async () => {
  let call;
  const client = {
    subnames: {
      addSubname: async (...args) => {
        call = args;
        return { ens: 'jaden7.coineasy.eth', claimedAt: expirationTime };
      },
    },
  };
  const message = challenge();
  const signature = await account.signMessage({ message });
  const result = await addJustaNameSubname({
    client,
    username: 'jaden7',
    address: account.address,
    message,
    signature,
    config,
  });

  assert.equal(result.ens, 'jaden7.coineasy.eth');
  assert.deepEqual(call[0].addresses, [
    { address: account.address, coinType: 60 },
    { address: account.address, coinType: BASE_COIN_TYPE },
  ]);
  assert.equal(BASE_COIN_TYPE, 2147492101);
  assert.deepEqual(call[1], {
    xApiKey: config.apiKey,
    xAddress: account.address,
    xMessage: message,
    xSignature: signature,
  });
});

test('existing provider records can safely reconcile an interrupted issuance', async () => {
  const record = {
    ens: 'jaden7.coineasy.eth',
    isClaimed: true,
    records: {
      coins: [{ id: BASE_COIN_TYPE, value: account.address }],
    },
  };
  const client = {
    subnames: {
      getSubname: async (params) => {
        assert.deepEqual(params, { subname: record.ens, chainId: 1 });
        return record;
      },
    },
  };
  assert.equal(await getJustaNameSubname({
    client,
    subname: record.ens,
    config,
  }), record);
  assert.equal(subnameResolvesToAddress(record, account.address), true);
  assert.equal(subnameResolvesToAddress(record, '0x0000000000000000000000000000000000000001'), false);
});
