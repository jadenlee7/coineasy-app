import assert from 'node:assert/strict';
import test from 'node:test';

import { profileFields } from '../src/routes/profiles.js';

const USER = Object.freeze({
  id: 'user-1',
  username: 'easygo_user',
  displayName: 'EasyGo User',
  pfp: null,
  bio: null,
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  subnameStatus: 'NONE',
  subname: null,
  createdAt: new Date('2026-08-02T00:00:00.000Z'),
});

test('public social profiles do not disclose wallet addresses', () => {
  const profile = profileFields(USER);
  assert.equal(Object.hasOwn(profile, 'walletAddress'), false);
});

test('authenticated own-profile projection retains the wallet address', () => {
  const profile = profileFields(USER, { includeWalletAddress: true });
  assert.equal(profile.walletAddress, USER.walletAddress);
});
