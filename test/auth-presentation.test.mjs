import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fallbackPresentationData,
  mergeOwnProfilePresentation,
  profilePresentationData,
} from '../hooks/authPresentation.mjs';

test('ledger orangeBalance immediately overrides legacy presentation balance', () => {
  const data = profilePresentationData({
    id: 'easygo-user-1',
    walletAddress: '0x1234',
    orangeBalance: 100,
    data: { numberOranges: 0, theme: 'orange' },
  }, {
    courseProgressOwner: 'did:privy:user-1',
  });

  assert.deepEqual(data, {
    numberOranges: 100,
    theme: 'orange',
    courseProgressOwner: 'did:privy:user-1',
    easygoUserId: 'easygo-user-1',
    walletAddress: '0x1234',
  });
});

test('local courses merge without discarding hydrated auth fields', () => {
  const courses = [{ id: 'course-1', progress: 2 }];
  const data = profilePresentationData({
    id: 'easygo-user-1',
    orangeBalance: 25,
    data: { locale: 'ko', courses: [{ id: 'stale' }] },
  }, {
    courseProgressOwner: 'did:privy:user-1',
    localCourses: courses,
  });

  assert.equal(data.numberOranges, 25);
  assert.equal(data.locale, 'ko');
  assert.equal(data.courses, courses);
});

test('fallback presentation is account-scoped and does not invent a balance', () => {
  assert.deepEqual(fallbackPresentationData({
    courseProgressOwner: 'did:privy:user-2',
  }), {
    courseProgressOwner: 'did:privy:user-2',
  });
});

test('public own-profile refresh cannot erase the private auth wallet address', () => {
  const current = {
    id: 'easygo-user-1',
    did: 'did:privy:apple-user',
    profile: {
      username: 'Before',
      data: {
        easygoUserId: 'easygo-user-1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        privateSetting: true,
      },
    },
  };
  const refreshed = {
    id: 'easygo-user-1',
    did: 'easygo:easygo-user-1',
    profile: {
      username: 'After',
      data: {
        easygoUserId: 'easygo-user-1',
        walletAddress: null,
        joinedAt: '2026-08-13T00:00:00.000Z',
      },
    },
  };

  const merged = mergeOwnProfilePresentation(current, refreshed);

  assert.equal(merged.profile.username, 'After');
  assert.equal(merged.did, 'did:privy:apple-user');
  assert.equal(merged.profile.data.joinedAt, '2026-08-13T00:00:00.000Z');
  assert.equal(merged.profile.data.privateSetting, true);
  assert.equal(
    merged.profile.data.walletAddress,
    '0x1111111111111111111111111111111111111111',
  );
});

test('private own-profile refresh can replace a previously hydrated wallet address', () => {
  const merged = mergeOwnProfilePresentation({
    profile: {
      data: { walletAddress: '0x1111111111111111111111111111111111111111' },
    },
  }, {
    profile: {
      data: { walletAddress: '0x2222222222222222222222222222222222222222' },
    },
  });

  assert.equal(
    merged.profile.data.walletAddress,
    '0x2222222222222222222222222222222222222222',
  );
});
