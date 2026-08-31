import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SocialViewerAuthorizationError,
  resolveOptionalSocialViewerWith,
} from '../src/lib/social-viewer-policy.js';

const rejectAuth = (error) => (
  error instanceof SocialViewerAuthorizationError
  && error.status === 401
  && error.code === 'invalid_token'
);

test('only an absent Authorization header receives the anonymous social view', async () => {
  let verifyCalls = 0;
  const result = await resolveOptionalSocialViewerWith({ headers: {} }, {
    db: { user: { async findUnique() { throw new Error('must not query'); } } },
    verify: async () => { verifyCalls += 1; },
  });
  assert.equal(result, null);
  assert.equal(verifyCalls, 0);
});

test('malformed, invalid, expired, and unsynced supplied bearers fail closed', async () => {
  await assert.rejects(
    resolveOptionalSocialViewerWith({ headers: { authorization: 'Basic secret' } }, {
      db: {},
      verify: async () => ({ userId: 'unused' }),
    }),
    rejectAuth,
  );
  await assert.rejects(
    resolveOptionalSocialViewerWith({ headers: { authorization: 'Bearer expired' } }, {
      db: {},
      verify: async () => { throw new Error('expired'); },
    }),
    rejectAuth,
  );
  await assert.rejects(
    resolveOptionalSocialViewerWith({ headers: { authorization: 'Bearer valid' } }, {
      db: { user: { async findUnique() { return null; } } },
      verify: async () => ({ userId: 'did:valid-unsynced' }),
    }),
    rejectAuth,
  );
});

test('a valid supplied bearer returns its local viewer for block filtering', async () => {
  let query;
  const viewer = await resolveOptionalSocialViewerWith({
    headers: { authorization: 'Bearer valid' },
  }, {
    db: {
      user: {
        async findUnique(options) {
          query = options;
          return { id: 'viewer_1' };
        },
      },
    },
    verify: async (token) => {
      assert.equal(token, 'valid');
      return { userId: 'did:viewer-1' };
    },
  });
  assert.deepEqual(query, {
    where: { privyDid: 'did:viewer-1' },
    select: { id: true },
  });
  assert.deepEqual(viewer, { id: 'viewer_1' });
});

test('database outages remain server errors instead of being mislabeled as token failures', async () => {
  const outage = new Error('database unavailable');
  await assert.rejects(
    resolveOptionalSocialViewerWith({ headers: { authorization: 'Bearer valid' } }, {
      db: { user: { async findUnique() { throw outage; } } },
      verify: async () => ({ userId: 'did:viewer-1' }),
    }),
    (error) => error === outage,
  );
});
