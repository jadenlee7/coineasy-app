import assert from 'node:assert/strict';
import test from 'node:test';
import { createQuestVerifier, QuestError } from '../src/lib/quest-verifier.js';

const SENDER = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TX_HASH = `0x${'a'.repeat(64)}`;
const BLOCK_TIME = new Date('2026-07-21T12:00:05.000Z');

function client(overrides = {}) {
  return {
    getChainId: async () => 8453,
    getTransactionReceipt: async () => ({
      status: 'success',
      from: SENDER,
      blockNumber: 100n,
      logs: [{ address: USDC, topics: [TOPIC] }],
    }),
    getTransaction: async () => ({
      from: SENDER,
      to: USDC,
      input: `0xa9059cbb${'0'.repeat(64)}`,
      value: 5n,
    }),
    getBlock: async () => ({ timestamp: BigInt(BLOCK_TIME.getTime() / 1_000) }),
    getBlockNumber: async () => 102n,
    ...overrides,
  };
}

const REQUIREMENTS = {
  schemaVersion: 1,
  kind: 'base_transaction',
  chainId: 8453,
  minimumConfirmations: 3,
  toAddress: USDC,
  functionSelector: '0xa9059cbb',
  minimumValueWei: '5',
  requiredEvent: { contractAddress: USDC, topic0: TOPIC },
};

async function verify(publicClient = client()) {
  return createQuestVerifier({ publicClient }).verifyBaseTransaction({
    requirements: REQUIREMENTS,
    txHash: TX_HASH,
    verifiedAddress: SENDER,
    startedAt: new Date('2026-07-21T12:00:00.000Z'),
    now: new Date('2026-07-21T12:01:00.000Z'),
  });
}

test('Base quest verifier binds sender, predicates, start time, and confirmations', async () => {
  assert.deepEqual(await verify(), {
    schemaVersion: 1,
    kind: 'base_transaction',
    chainId: 8453,
    txHash: TX_HASH,
    blockNumber: '100',
  });
});

test('sender and event mismatches are definitive failures', async () => {
  await assert.rejects(
    () => verify(client({ getTransaction: async () => ({
      from: OTHER,
      to: USDC,
      input: `0xa9059cbb${'0'.repeat(64)}`,
      value: 5n,
    }) })),
    (error) => error instanceof QuestError
      && error.code === 'transaction_sender_mismatch'
      && error.retryable === false,
  );
  await assert.rejects(
    () => verify(client({ getTransactionReceipt: async () => ({
      status: 'success',
      from: SENDER,
      blockNumber: 100n,
      logs: [],
    }) })),
    (error) => error.code === 'required_event_missing',
  );
});

test('unmined and underconfirmed transactions remain retryable', async () => {
  const notFound = new Error('not found');
  notFound.name = 'TransactionReceiptNotFoundError';
  await assert.rejects(
    () => verify(client({ getTransactionReceipt: async () => { throw notFound; } })),
    (error) => error.code === 'transaction_not_mined'
      && error.status === 409
      && error.retryable === true,
  );
  await assert.rejects(
    () => verify(client({ getBlockNumber: async () => 101n })),
    (error) => error.code === 'transaction_underconfirmed'
      && error.retryable === true,
  );
});

test('transactions from before the explicit quest start are rejected', async () => {
  await assert.rejects(
    () => createQuestVerifier({ publicClient: client() }).verifyBaseTransaction({
      requirements: REQUIREMENTS,
      txHash: TX_HASH,
      verifiedAddress: SENDER,
      startedAt: new Date('2026-07-21T12:00:07.000Z'),
      now: new Date('2026-07-21T12:01:00.000Z'),
    }),
    (error) => error.code === 'transaction_predates_quest_start',
  );
});
