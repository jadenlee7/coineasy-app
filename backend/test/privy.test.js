import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractAppleSubject,
  extractProfile,
  PrivyIdentityError,
} from '../src/lib/privy.js';

function privyUser(linkedAccounts) {
  return { id: 'did:privy:test', linkedAccounts };
}

test('Apple subject extraction accepts zero or one distinct server identity', () => {
  assert.equal(extractAppleSubject(privyUser([])), null);
  assert.equal(extractAppleSubject(privyUser([
    { type: 'apple_oauth', subject: 'apple-subject-1', email: 'relay@example.com' },
  ])), 'apple-subject-1');
  assert.equal(extractAppleSubject(privyUser([
    { type: 'apple_oauth', subject: 'apple-subject-1' },
    { type: 'apple_oauth', subject: 'apple-subject-1' },
  ])), 'apple-subject-1');
});

test('conflicting or malformed Apple identities fail closed', () => {
  const invalidAccounts = [
    [{ type: 'apple_oauth', subject: '' }],
    [{ type: 'apple_oauth', subject: ' surrounded ' }],
    [{ type: 'apple_oauth', subject: 'x'.repeat(1025) }],
    [
      { type: 'apple_oauth', subject: 'apple-a' },
      { type: 'apple_oauth', subject: 'apple-b' },
    ],
  ];
  for (const linkedAccounts of invalidAccounts) {
    assert.throws(
      () => extractAppleSubject(privyUser(linkedAccounts)),
      (error) => error instanceof PrivyIdentityError,
    );
  }
});

test('the persisted profile never contains Apple subject or relay email', () => {
  const rawSubject = 'apple-never-persist-this';
  const rawEmail = 'relay-never-persist@example.com';
  const profile = extractProfile(privyUser([
    { type: 'apple_oauth', subject: rawSubject, email: rawEmail },
    {
      type: 'wallet',
      chainType: 'ethereum',
      address: '0x0000000000000000000000000000000000000001',
    },
  ]));
  const serialized = JSON.stringify(profile);
  assert.equal(serialized.includes(rawSubject), false);
  assert.equal(serialized.includes(rawEmail), false);
  assert.deepEqual(Object.keys(profile).sort(), [
    'kakaoId',
    'privyDid',
    'telegramId',
    'telegramUsername',
    'walletAddress',
  ]);
});
