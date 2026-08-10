import assert from 'node:assert/strict';
import test from 'node:test';
import { privateKeyToAccount } from 'viem/accounts';
import {
  BASE_CHAIN_ID,
  createSiweChallenge,
  getSiweConfig,
  hashSiweNonce,
  nonceHashMatches,
  parseAndValidateSiweMessage,
  SiweValidationError,
  verifySiweSignature,
} from '../src/lib/siwe.js';

const account = privateKeyToAccount(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
);
const otherAccount = privateKeyToAccount(
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
);
const config = {
  domain: 'api.easygo.test',
  uri: 'https://api.easygo.test/siwe',
  scheme: 'https',
  statement: 'Sign in to EasyGo and verify ownership of this wallet.',
};
const now = new Date('2026-07-20T12:00:00.000Z');

function challengeAndMessage() {
  const challenge = createSiweChallenge({
    address: account.address,
    config,
    now,
    nonce: 'EasyGoNonce1234',
  });
  return { challenge, message: challenge.message };
}

test('SIWE config requires an exact production HTTPS origin', () => {
  assert.deepEqual(
    getSiweConfig({
      NODE_ENV: 'production',
      SIWE_DOMAIN: 'api.easygo.test',
      SIWE_URI: 'https://api.easygo.test/siwe',
    }),
    {
      domain: 'api.easygo.test',
      uri: 'https://api.easygo.test/siwe',
      scheme: 'https',
      statement: 'Sign in to EasyGo and verify ownership of this wallet.',
    },
  );
  assert.throws(() => getSiweConfig({
    NODE_ENV: 'production',
    SIWE_DOMAIN: 'api.easygo.test',
    SIWE_URI: 'http://api.easygo.test/siwe',
  }), /https/);
  assert.throws(() => getSiweConfig({
    SIWE_DOMAIN: 'api.easygo.test',
    SIWE_URI: 'https://evil.test/siwe',
  }), /authority/);
});

test('challenge is Base-only, expires in ten minutes, and binds the nonce', () => {
  const { challenge, message } = challengeAndMessage();
  assert.equal(challenge.chainId, BASE_CHAIN_ID);
  assert.equal(challenge.issuedAt, '2026-07-20T12:00:00.000Z');
  assert.equal(challenge.expirationTime, '2026-07-20T12:10:00.000Z');
  assert.ok(nonceHashMatches(challenge.nonce, hashSiweNonce(challenge.nonce)));

  const parsed = parseAndValidateSiweMessage({
    message,
    expectedAddress: account.address,
    expectedNonceHash: hashSiweNonce(challenge.nonce),
    expectedExpiresAt: new Date(challenge.expirationTime),
    config,
    now: new Date('2026-07-20T12:05:00.000Z'),
  });
  assert.equal(parsed.address, account.address);
  assert.equal(parsed.chainId, BASE_CHAIN_ID);
});

test('challenge rejects replay after expiry and origin tampering', () => {
  const { challenge, message } = challengeAndMessage();
  const common = {
    expectedAddress: account.address,
    expectedNonceHash: hashSiweNonce(challenge.nonce),
    expectedExpiresAt: new Date(challenge.expirationTime),
    config,
  };
  assert.throws(
    () => parseAndValidateSiweMessage({
      ...common,
      message,
      now: new Date('2026-07-20T12:10:00.000Z'),
    }),
    (error) => error instanceof SiweValidationError && error.code === 'nonce_expired',
  );
  assert.throws(
    () => parseAndValidateSiweMessage({
      ...common,
      message: message.replace('api.easygo.test wants', 'evil.test wants'),
      now,
    }),
    (error) => error instanceof SiweValidationError && error.code === 'invalid_origin',
  );
});

test('EOA signature verifies locally without an RPC request', async () => {
  const { challenge, message } = challengeAndMessage();
  const signature = await account.signMessage({ message });
  const client = {
    verifySiweMessage: async () => {
      throw new Error('RPC fallback should not be used for an EOA');
    },
  };
  assert.equal(await verifySiweSignature({
    message,
    signature,
    address: account.address,
    nonce: challenge.nonce,
    config,
    client,
  }), true);

  const wrongSignature = await otherAccount.signMessage({ message });
  assert.equal(await verifySiweSignature({
    message,
    signature: wrongSignature,
    address: account.address,
    nonce: challenge.nonce,
    config,
    client: { verifySiweMessage: async () => false },
  }), false);
});
