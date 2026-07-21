import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAdvertiserAuth,
  hashAdvertiserApiKey,
  parseAdvertiserKeyHashes,
  resolveAdvertiserSlug,
} from '../src/lib/advertiser-auth.js';

const KEY = `eg_adv_${'a'.repeat(32)}`;
const SLUG = 'demo-partner';

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('advertiser key configuration stores digests and resolves one scoped slug', () => {
  const digest = hashAdvertiserApiKey(KEY);
  const entries = parseAdvertiserKeyHashes(JSON.stringify({ [SLUG]: digest }));
  assert.deepEqual(entries, [[SLUG, digest]]);
  assert.equal(resolveAdvertiserSlug(KEY, entries), SLUG);
  assert.equal(resolveAdvertiserSlug(`eg_adv_${'b'.repeat(32)}`, entries), null);
  assert.throws(() => parseAdvertiserKeyHashes(JSON.stringify({ [SLUG]: KEY })));
});

test('advertiser auth binds an active database advertiser without trusting request IDs', async () => {
  let queriedSlug;
  const db = {
    advertiser: {
      findUnique: async ({ where }) => {
        queriedSlug = where.slug;
        return { id: 'advertiser_1', slug: SLUG, name: 'Demo', status: 'ACTIVE' };
      },
    },
  };
  const middleware = createAdvertiserAuth({
    db,
    env: {
      ADVERTISER_API_KEY_HASHES_JSON: JSON.stringify({
        [SLUG]: hashAdvertiserApiKey(KEY),
      }),
    },
  });
  const req = { headers: { authorization: `Bearer ${KEY}` } };
  const res = response();
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(queriedSlug, SLUG);
  assert.deepEqual(req.advertiser, {
    id: 'advertiser_1',
    slug: SLUG,
    name: 'Demo',
    status: 'ACTIVE',
  });
});

test('invalid, unconfigured, and inactive advertiser credentials fail closed', async () => {
  const unconfigured = createAdvertiserAuth({ db: { advertiser: {} }, env: {} });
  const unconfiguredRes = response();
  await unconfigured(
    { headers: { authorization: `Bearer ${KEY}` } },
    unconfiguredRes,
    () => assert.fail('must not authenticate'),
  );
  assert.equal(unconfiguredRes.statusCode, 503);
  assert.equal(unconfiguredRes.body.error, 'advertiser_admin_unconfigured');

  const inactive = createAdvertiserAuth({
    db: { advertiser: { findUnique: async () => ({ status: 'SUSPENDED' }) } },
    env: {
      ADVERTISER_API_KEY_HASHES_JSON: JSON.stringify({
        [SLUG]: hashAdvertiserApiKey(KEY),
      }),
    },
  });
  const inactiveRes = response();
  await inactive(
    { headers: { authorization: `Bearer ${KEY}` } },
    inactiveRes,
    () => assert.fail('must not authenticate'),
  );
  assert.equal(inactiveRes.statusCode, 403);
  assert.equal(inactiveRes.body.error, 'advertiser_inactive');
});
