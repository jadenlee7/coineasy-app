import assert from 'node:assert/strict';
import test from 'node:test';
import { getTelegramBalanceById } from '../src/lib/telegram.js';

function makeDb({ userById = null, balance = null } = {}) {
  return {
    user: {
      findUnique: async () => userById,
    },
    orangeLedger: {
      aggregate: async () => ({ _sum: { delta: balance } }),
    },
  };
}

test('getTelegramBalanceById returns null when telegramId is missing', async () => {
  const result = await getTelegramBalanceById(makeDb(), '');
  assert.equal(result, null);
});

test('getTelegramBalanceById returns null for unknown telegramId', async () => {
  const result = await getTelegramBalanceById(makeDb({ userById: null }), '999');
  assert.equal(result, null);
});

test('getTelegramBalanceById returns userId and computed balance', async () => {
  const result = await getTelegramBalanceById(
    makeDb({ userById: { id: 'user-1' }, balance: 123 }),
    '12345',
  );
  assert.equal(result.userId, 'user-1');
  assert.equal(result.balance, 123);
});

