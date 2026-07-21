import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLegacySocialGate,
  legacySocialConfig,
  legacySocialStatus,
} from '../src/middleware/legacy-social.js';

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function runGate(env, method) {
  const middleware = createLegacySocialGate({ env });
  const res = response();
  let nextCalled = false;
  middleware({ method }, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('missing or invalid social mode remains active to prevent accidental retirement', () => {
  assert.equal(legacySocialConfig({}).mode, 'active');
  assert.equal(legacySocialConfig({ LEGACY_SOCIAL_MODE: 'typo' }).mode, 'active');
  assert.deepEqual(legacySocialStatus({}), {
    mode: 'active',
    readsAvailable: true,
    writesAvailable: true,
    sunsetAt: null,
    export: { method: 'GET', path: '/me/social-export' },
  });
});

test('read-only mode preserves reads and retires mutations with an export link', async () => {
  const read = await runGate({ LEGACY_SOCIAL_MODE: 'read_only' }, 'GET');
  assert.equal(read.nextCalled, true);

  const write = await runGate({
    LEGACY_SOCIAL_MODE: 'read_only',
    LEGACY_SOCIAL_SUNSET_AT: '2026-09-01T00:00:00.000Z',
  }, 'POST');
  assert.equal(write.nextCalled, false);
  assert.equal(write.res.statusCode, 410);
  assert.equal(write.res.body.error, 'legacy_social_writes_retired');
  assert.equal(write.res.body.mode, 'read_only');
  assert.equal(write.res.body.sunsetAt, '2026-09-01T00:00:00.000Z');
  assert.deepEqual(write.res.body.export, { method: 'GET', path: '/me/social-export' });
  assert.equal(write.res.headers['Cache-Control'], 'no-store');
});

test('retired mode returns 410 for social reads while leaving export outside the gate', async () => {
  const result = await runGate({ LEGACY_SOCIAL_MODE: 'retired' }, 'GET');
  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 410);
  assert.equal(result.res.body.error, 'legacy_social_retired');
  assert.equal(result.res.body.readsAvailable, false);
  assert.equal(result.res.body.writesAvailable, false);
});
