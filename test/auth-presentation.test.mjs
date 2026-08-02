import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fallbackPresentationData,
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
