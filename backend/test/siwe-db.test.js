import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createSiweChallenge,
  hashSiweNonce,
  parseAndValidateSiweMessage,
  verifySiweSignature,
} from '../src/lib/siwe.js';

const databaseUrl = process.env.TEST_DATABASE_URL;

test('SIWE nonce persistence is single-use', { skip: !databaseUrl }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const account = privateKeyToAccount(
    '0x5de4111afa1c4b3daadb3b1efb3a062faa17b3680332b7e29aa0d8c42f66ea4a',
  );
  const config = {
    domain: 'api.easygo.test',
    uri: 'https://api.easygo.test/siwe',
    scheme: 'https',
    statement: 'Sign in to EasyGo and verify ownership of this wallet.',
  };
  const challenge = createSiweChallenge({
    address: account.address,
    config,
    now: new Date('2026-07-20T12:00:00.000Z'),
    nonce: 'DatabaseNonce1234',
  });
  const nonceHash = hashSiweNonce(challenge.nonce);

  try {
    const user = await prisma.user.upsert({
      where: { privyDid: 'did:privy:easygo-siwe-test' },
      update: {},
      create: {
        id: 'easygo_siwe_test_user',
        privyDid: 'did:privy:easygo-siwe-test',
        username: 'easygosiwetest',
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        siweNonceHash: nonceHash,
        siweNonceAddress: challenge.address,
        siweNonceExpiresAt: new Date(challenge.expirationTime),
      },
    });

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    const parsed = parseAndValidateSiweMessage({
      message: challenge.message,
      expectedAddress: stored.siweNonceAddress,
      expectedNonceHash: stored.siweNonceHash,
      expectedExpiresAt: stored.siweNonceExpiresAt,
      config,
      now: new Date('2026-07-20T12:05:00.000Z'),
    });
    const signature = await account.signMessage({ message: challenge.message });
    assert.equal(await verifySiweSignature({
      message: challenge.message,
      signature,
      address: parsed.address,
      nonce: parsed.nonce,
      config,
      client: { verifySiweMessage: async () => false },
    }), true);

    const firstConsume = await prisma.user.updateMany({
      where: { id: user.id, siweNonceHash: nonceHash },
      data: {
        verifiedAddress: parsed.address,
        siweChainId: parsed.chainId,
        siweVerifiedAt: new Date('2026-07-20T12:05:00.000Z'),
        siweNonceHash: null,
        siweNonceAddress: null,
        siweNonceExpiresAt: null,
      },
    });
    const replayConsume = await prisma.user.updateMany({
      where: { id: user.id, siweNonceHash: nonceHash },
      data: { siweNonceHash: null },
    });
    assert.equal(firstConsume.count, 1);
    assert.equal(replayConsume.count, 0);
  } finally {
    await prisma.user.deleteMany({ where: { privyDid: 'did:privy:easygo-siwe-test' } });
    await prisma.$disconnect();
  }
});
